// GClifts server logic, shared by the local dev server (server/local.mjs) and the AWS Lambda (server/lambda.mjs).
//
// Clients talk over a WebSocket by sending JSON {action, ...}. The server answers and pushes updates as JSON {type, ...}.
// Storage is a small key-value interface so the same code runs on an in-memory map or on DynamoDB:
//   db.get(pk, sk) -> item | undefined     db.put(item)     db.del(pk, sk)     db.query(pk, skPrefix) -> items
//   send(connectionId, message) -> false when the connection is gone
//
// Keys:
//   CONNS / <connectionId>          every open connection, with the email signed in on it (if any)
//   USER#<email> / CONN#<id>        connections of one user, so updates reach all their devices
//   USER#<email> / RIDE#<rideId>    rides a user is in, as rider or driver
//   CODE / <email>                  pending 6-digit sign-in code
//   TOKEN / <token>                 signed-in session
//   DRIVERS / <email>               driver profiles
//   RIDE#<rideId> / META            the ride
//   RIDE#<rideId> / MSG#<time>#<id> chat messages in that ride

export const SCHOOL={name:"Georgia College & State University",domains:["gcsu.edu","bobcats.gcsu.edu"]};
export const PAY=["Cash App","Venmo","PayPal"];
export const PURPOSES={Groceries:true,Pharmacy:true,Clinic:true,"Job interview":true,Class:false,Other:false};
const ACTIVE=["requested","connected","onway","here"];
const CODE_TTL=15*60e3, TOKEN_TTL=30*24*3600e3, MAX_TEXT=1000;

const rid=n=>{let s="";const a="abcdefghijkmnpqrstuvwxyz23456789";const b=crypto.getRandomValues(new Uint8Array(n));for(const x of b)s+=a[x%a.length];return s};
const clean=(t,max=120)=>String(t??"").replace(/\s+/g," ").trim().slice(0,max);
const validEmail=e=>/^[^@\s]+@[^@\s]+$/.test(e)&&SCHOOL.domains.includes(e.split("@")[1]);
class UserError extends Error{}
const fail=m=>{throw new UserError(m)};

export function createServer({db,send,now=()=>Date.now(),demoCodes=true,sendCode=null}){
  const user=async conn=>{const c=await db.get("CONNS",conn);return c?.email?c:null};
  const need=async conn=>(await user(conn))||fail("Sign in again to continue.");
  const toUser=async(email,msg)=>{for(const c of await db.query("USER#"+email,"CONN#")){
    if(await send(c.sk.slice(5),msg)===false)await drop(c.sk.slice(5))}};
  // Only signed-in connections get the driver list.
  const toAll=async msg=>{for(const c of await db.query("CONNS",""))if(c.email&&await send(c.sk,msg)===false)await drop(c.sk)};
  async function drop(conn){const c=await db.get("CONNS",conn);await db.del("CONNS",conn);if(c?.email)await db.del("USER#"+c.email,"CONN#"+conn)}

  const drivers=async()=>(await db.query("DRIVERS","")).map(({pk,sk,...d})=>d);
  const ride=async id=>{const r=await db.get("RIDE#"+id,"META");if(!r)return null;const{pk,sk,...x}=r;return x};
  const messages=async id=>(await db.query("RIDE#"+id,"MSG#")).map(({pk,sk,...m})=>m);
  const ridesOf=async email=>{const out=[];for(const p of await db.query("USER#"+email,"RIDE#")){const r=await ride(p.sk.slice(5));if(r)out.push(r)}
    return out.sort((a,b)=>b.createdAt-a.createdAt)};
  const saveRide=r=>db.put({pk:"RIDE#"+r.id,sk:"META",...r});
  const busySeats=async email=>(await ridesOf(email)).filter(r=>r.driverEmail===email&&ACTIVE.slice(1).includes(r.status)).length;
  const openSeats=async d=>d.seats-await busySeats(d.email);
  // Push the ride (with its messages) to both people in it.
  const pushRide=async r=>{const msg={type:"ride",ride:{...r,messages:await messages(r.id)}};
    await toUser(r.riderEmail,msg);if(r.driverEmail)await toUser(r.driverEmail,msg)};
  const pushDrivers=async()=>{const list=[];for(const d of await drivers())list.push({...publicDriver(d),open:await openSeats(d)});await toAll({type:"drivers",drivers:list})};
  const publicDriver=({email,name,car,seats,pay,online})=>({email,name,car,seats,pay,online});

  // Matching: requested driver, past rides together, payment overlap. Essential trips may take a driver's last seat.
  async function match(rider,r){
    const essential=PURPOSES[r.purpose];const past=(await ridesOf(rider)).filter(x=>x.status==="done");
    let best=null;
    for(const d of await drivers()){
      if(!d.online||d.email===rider||r.declined.includes(d.email))continue;
      const open=await openSeats(d);if(open<1||(!essential&&open<2))continue;
      const together=past.filter(x=>x.driverEmail===d.email),avg=together.length?together.reduce((t,x)=>t+(x.rating||0),0)/together.length:0;
      const overlap=d.pay.filter(p=>r.pay.includes(p));
      let score=Math.random(),why=[];
      if(r.prefer===d.email){score+=100;why.push(`You asked for ${d.name.split(" ")[0]}`)}
      if(together.length){score+=10+together.length*3+avg;why.push(`${together.length} past ride${together.length>1?"s":""} together, ${avg.toFixed(1)} stars`)}
      if(overlap.length){score+=8;why.push(`Takes ${overlap.join(" or ")}`)}else score-=6;
      if(essential&&open===1)why.push("Held their last seat for an essential trip");
      if(!best||score>best.score)best={d,score,why};
    }
    return best;
  }
  async function offer(r){
    const m=await match(r.riderEmail,r);
    if(!m){r.status="nomatch";r.driverEmail=null;await saveRide(r);await pushRide(r);return}
    r.driverEmail=m.d.email;r.driverName=m.d.name;r.car=m.d.car;r.driverPay=m.d.pay;r.why=m.why;r.status="requested";
    await saveRide(r);await db.put({pk:"USER#"+m.d.email,sk:"RIDE#"+r.id});await pushRide(r);
  }
  const mine=async(conn,id)=>{const u=await need(conn),r=await ride(id);
    if(!r||(r.riderEmail!==u.email&&r.driverEmail!==u.email))fail("That ride isn't yours.");return[u,r]};
  const say=async(r,from,name,text,extra={})=>{const t=now();
    await db.put({pk:"RIDE#"+r.id,sk:`MSG#${String(t).padStart(15,"0")}#${rid(4)}`,from,name,text,t,...extra})};

  const actions={
    // Sign-in, step 1: check the school email and send a code.
    async start(conn,{email,name}){
      email=clean(email,120).toLowerCase();name=clean(name,60);
      if(!validEmail(email))fail(`Use your ${SCHOOL.name} email. It must end in @${SCHOOL.domains.join(" or @")}.`);
      if(!name)fail("Enter your name so drivers know who to pick up.");
      const code=String(100000+Math.floor(Math.random()*900000));
      await db.put({pk:"CODE",sk:email,code,name,expires:now()+CODE_TTL,tries:0});
      if(sendCode)await sendCode(email,code);
      return{type:"code",email,demoCode:demoCodes?code:undefined};
    },
    // Sign-in, step 2: check the code and hand out a session token.
    async verify(conn,{email,code}){
      email=clean(email,120).toLowerCase();const c=await db.get("CODE",email);
      if(!c||c.expires<now())fail("That code expired. Send a new one.");
      if(c.tries>=5){await db.del("CODE",email);fail("Too many wrong codes. Send a new one.")}
      if(String(code).replace(/\D/g,"")!==c.code){await db.put({...c,tries:c.tries+1});fail("That code doesn't match. Check the email and try again.")}
      await db.del("CODE",email);const token=rid(32);
      await db.put({pk:"TOKEN",sk:token,email,name:c.name,expires:now()+TOKEN_TTL});
      return{...await actions.hello(conn,{token}),token};
    },
    // Reconnect with a saved token. Returns everything this user needs to draw the app.
    async hello(conn,{token}){
      const t=token&&await db.get("TOKEN",String(token));
      if(!t||t.expires<now())return{type:"signedout"};
      await db.put({pk:"CONNS",sk:conn,email:t.email,name:t.name});await db.put({pk:"USER#"+t.email,sk:"CONN#"+conn});
      const rides=[];for(const r of await ridesOf(t.email))rides.push({...r,messages:await messages(r.id)});
      const me=await db.get("DRIVERS",t.email);const list=[];for(const d of await drivers())list.push({...publicDriver(d),open:await openSeats(d)});
      return{type:"state",user:{email:t.email,name:t.name,school:SCHOOL.name},driver:me?publicDriver(me):null,drivers:list,rides};
    },
    async signout(conn,{token}){if(token)await db.del("TOKEN",String(token));await drop(conn);await db.put({pk:"CONNS",sk:conn});return{type:"signedout"}},

    async driver(conn,{car,seats,pay,online}){
      const u=await need(conn);car=clean(car,60);seats=Math.max(1,Math.min(6,Math.floor(+seats)||1));pay=PAY.filter(p=>(pay||[]).includes(p));
      if(!car)fail("Add your car so riders can spot you.");if(!pay.length)fail("Pick at least one way you'd like to be paid.");
      await db.put({pk:"DRIVERS",sk:u.email,email:u.email,name:u.name,car,seats,pay,online:!!online});
      await pushDrivers();return{type:"driver",driver:{email:u.email,name:u.name,car,seats,pay,online:!!online}};
    },

    // Rider asks to connect with a driver. No addresses: the two agree on places in the chat.
    async request(conn,{purpose,pay,prefer}){
      const u=await need(conn);
      if(!(purpose in PURPOSES))fail("Pick what the trip is for.");
      pay=PAY.filter(p=>(pay||[]).includes(p));if(!pay.length)fail("Choose at least one way you can pay.");
      if((await ridesOf(u.email)).some(r=>r.riderEmail===u.email&&ACTIVE.includes(r.status)))fail("You already have a ride in progress.");
      const r={id:rid(10),code:"GC-"+(1000+Math.floor(Math.random()*9000)),riderEmail:u.email,riderName:u.name,purpose,pay,
        prefer:prefer?String(prefer):null,declined:[],status:"requested",createdAt:now(),driverEmail:null};
      await db.put({pk:"USER#"+u.email,sk:"RIDE#"+r.id});await offer(r);await pushDrivers();return{type:"ok"};
    },
    // Driver accepts or passes. Passing offers the ride to the next driver.
    async respond(conn,{rideId,accept}){
      const[u,r]=await mine(conn,rideId);if(r.driverEmail!==u.email||r.status!=="requested")fail("This request is no longer waiting for you.");
      if(accept){r.status="connected";r.connectedAt=now();await saveRide(r);
        await say(r,"system","GClifts",`${r.driverName} accepted. Use this chat to agree on the pickup spot and drop-off.`);await pushRide(r)}
      else{r.declined.push(u.email);await db.del("USER#"+u.email,"RIDE#"+r.id);await offer(r)}
      await pushDrivers();return{type:"ok"};
    },
    async message(conn,{rideId,text,lat,lng}){
      const[u,r]=await mine(conn,rideId);if(!["connected","onway","here","done"].includes(r.status))fail("You can message once the driver accepts.");
      if(lat!=null){lat=+lat;lng=+lng;if(!(Math.abs(lat)<=90&&Math.abs(lng)<=180))fail("That location isn't valid.");
        await say(r,u.email,u.name,"Shared a location",{lat:+lat.toFixed(5),lng:+lng.toFixed(5)})}
      else{text=clean(text,MAX_TEXT);if(!text)return{type:"ok"};await say(r,u.email,u.name,text)}
      await pushRide(r);return{type:"ok"};
    },
    // Driver progress: on the way, then here.
    async progress(conn,{rideId,status}){
      const[u,r]=await mine(conn,rideId);if(r.driverEmail!==u.email)fail("Only the driver can update the trip.");
      if(!(["onway","here"].includes(status)&&["connected","onway"].includes(r.status)))fail("The ride can't move to that step.");
      r.status=status;await saveRide(r);await say(r,"system","GClifts",status==="onway"?`${r.driverName} is on the way.`:`${r.driverName} is here. Check the ride code ${r.code}.`);
      await pushRide(r);return{type:"ok"};
    },
    // Rider ends the ride and records how they paid.
    async finish(conn,{rideId,paidWith,rating}){
      const[u,r]=await mine(conn,rideId);if(r.riderEmail!==u.email)fail("Only the rider can finish the ride.");
      if(!["connected","onway","here"].includes(r.status))fail("This ride isn't in progress.");
      if(!(r.driverPay||[]).includes(paidWith))fail("Pick how you paid.");
      r.status="done";r.paidWith=paidWith;r.rating=Math.max(1,Math.min(5,Math.round(+rating)||5));r.confirmed=false;r.endedAt=now();
      await saveRide(r);await pushRide(r);await pushDrivers();return{type:"ok"};
    },
    async confirm(conn,{rideId}){
      const[u,r]=await mine(conn,rideId);if(r.driverEmail!==u.email||r.status!=="done")fail("Only the driver can confirm a finished ride.");
      r.confirmed=true;r.confirmedAt=now();await saveRide(r);await pushRide(r);return{type:"ok"};
    },
    async cancel(conn,{rideId}){
      const[u,r]=await mine(conn,rideId);if(!ACTIVE.includes(r.status)&&r.status!=="nomatch")fail("This ride already ended.");
      const was=r.status;r.status="canceled";r.canceledBy=u.email;await saveRide(r);
      if(was!=="requested"&&was!=="nomatch")await say(r,"system","GClifts",`${u.name} canceled the ride.`);
      await pushRide(r);await pushDrivers();return{type:"ok"};
    },
  };

  return{
    connect:async conn=>{await db.put({pk:"CONNS",sk:conn})},
    disconnect:drop,
    // Handle one message from a client. Returns the reply to send back on the same connection.
    async message(conn,raw){
      let m;try{m=JSON.parse(raw)}catch{return{type:"error",error:"Bad message."}}
      const f=Object.hasOwn(actions,m?.action)&&actions[m.action];
      if(!f)return{type:"error",error:"Unknown action.",reqId:m?.reqId};
      try{return{...await f(conn,m),reqId:m.reqId}}
      catch(e){if(e instanceof UserError)return{type:"error",error:e.message,reqId:m.reqId};console.error(e);return{type:"error",error:"Something went wrong on the server. Try again.",reqId:m.reqId}}
    },
  };
}

export function memoryDb(){
  const m=new Map(),k=(pk,sk)=>pk+"\u0000"+sk;
  return{
    async get(pk,sk){const v=m.get(k(pk,sk));return v&&structuredClone(v)},
    async put(item){m.set(k(item.pk,item.sk),structuredClone(item))},
    async del(pk,sk){m.delete(k(pk,sk))},
    async query(pk,prefix){return[...m.values()].filter(v=>v.pk===pk&&v.sk.startsWith(prefix)).sort((a,b)=>a.sk<b.sk?-1:1).map(v=>structuredClone(v))},
  };
}
