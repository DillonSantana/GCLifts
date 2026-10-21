// AWS Lambda handler for the API Gateway WebSocket API defined in template.yaml.
// Storage is one DynamoDB table (TABLE) with a string partition key `pk` and sort key `sk`.
// Environment: TABLE, DEMO_CODES ("true" shows the sign-in code on screen), SES_FROM (optional verified sender for code emails).
import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient,GetCommand,PutCommand,DeleteCommand,QueryCommand} from "@aws-sdk/lib-dynamodb";
import {ApiGatewayManagementApiClient,PostToConnectionCommand} from "@aws-sdk/client-apigatewaymanagementapi";
import {createServer} from "./core.mjs";

export function dynamoDb(table,client=DynamoDBDocumentClient.from(new DynamoDBClient({}),{marshallOptions:{removeUndefinedValues:true}})){
  return{
    async get(pk,sk){return(await client.send(new GetCommand({TableName:table,Key:{pk,sk}}))).Item},
    // Codes and sessions carry `expires` (ms); DynamoDB's TTL deletes them a while after `ttl` (seconds) passes.
    async put(item){await client.send(new PutCommand({TableName:table,Item:item.expires?{...item,ttl:Math.ceil(item.expires/1000)}:item}))},
    async del(pk,sk){await client.send(new DeleteCommand({TableName:table,Key:{pk,sk}}))},
    async query(pk,prefix){
      const out=[];let start;
      do{const r=await client.send(new QueryCommand({TableName:table,ExclusiveStartKey:start,
          KeyConditionExpression:prefix?"pk = :p AND begins_with(sk, :s)":"pk = :p",
          ExpressionAttributeValues:prefix?{":p":pk,":s":prefix}:{":p":pk}}));
        out.push(...r.Items);start=r.LastEvaluatedKey}while(start);
      return out.map(({ttl,...x})=>x);
    },
  };
}

async function sesSender(from){
  const {SESv2Client,SendEmailCommand}=await import("@aws-sdk/client-sesv2");const ses=new SESv2Client({});
  return(to,code)=>ses.send(new SendEmailCommand({FromEmailAddress:from,Destination:{ToAddresses:[to]},Content:{Simple:{
    Subject:{Data:`Your GClifts code: ${code}`},Body:{Text:{Data:`Your GClifts sign-in code is ${code}. It expires in 15 minutes.`}}}}}));
}

let app;
export async function handler(event,_ctx,deps={}){
  const {routeKey,connectionId,domainName,stage}=event.requestContext;
  if(!app){
    const api=deps.api||new ApiGatewayManagementApiClient({endpoint:`https://${domainName}/${stage}`});
    app=createServer({db:deps.db||dynamoDb(process.env.TABLE),demoCodes:process.env.DEMO_CODES!=="false",
      sendCode:process.env.SES_FROM?await sesSender(process.env.SES_FROM):null,
      send:async(id,msg)=>{try{await api.send(new PostToConnectionCommand({ConnectionId:id,Data:JSON.stringify(msg)}))}
        catch(e){if(e.name==="GoneException"||e.$metadata?.httpStatusCode===410)return false;throw e}}});
    app.post=async(id,msg)=>api.send(new PostToConnectionCommand({ConnectionId:id,Data:JSON.stringify(msg)}));
  }
  if(routeKey==="$connect"){await app.connect(connectionId);return{statusCode:200}}
  if(routeKey==="$disconnect"){await app.disconnect(connectionId);return{statusCode:200}}
  const reply=await app.message(connectionId,event.body||"");
  await app.post(connectionId,reply);
  return{statusCode:200};
}
