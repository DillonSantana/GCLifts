<img width="3712" height="1152" alt="Gemini_Generated_Image_akpzl3akpzl3akpz" src="https://github.com/user-attachments/assets/e83342ef-c5b5-4b0d-8e90-af8b4b88ccd9" />
# GClifts MVP: 
https://d3exvjki5n2jnm.cloudfront.net

A students-only ride-share for Georgia College & State University. Students get rides from verified classmates to the places that matter.

**Track:** Community & Wellbeing (AWS for Social Good)

## Problem

Milledgeville has limited public transit, and no rideshare apps are available. Students created a huge GroupMe group chat that has its own challenges, some members of the group chat are not part of the college some riders don't pay the driver, and sometimes the group chat is too chaotic to get a driver.

## Who it helps

- **Riders:** matched with a driver automatically, and every driver is a verified student.
- **Drivers:** matched with riders automatically, and they confirm in the app when each rider's payment arrives. Riders and drivers can message each other.

## GClifts: AWS services used

Live in production (https://d3exvjki5n2jnm.cloudfront.net)

Amazon S3: stores the app files (index.html and the compiled Tailwind CSS) in a private, encrypted bucket in us-east-2. Public access is blocked, so requests straight to S3 return 403.
Amazon CloudFront: delivers the site worldwide over HTTPS only, with HTTP/2 and HTTP/3, gzip/Brotli compression and security headers. Plain HTTP redirects to HTTPS. We clear the cache on each deploy so students always get the latest version.

CloudFront Origin Access Control and IAM: CloudFront signs its requests to S3 (SigV4), and the bucket policy only allows this one distribution to read from it.
Developer tooling

Kiro: the AI IDE we used to build, refactor and deploy the app.
AWS CLI v2 with aws login: browser sign-in with no long-lived access keys. AWS STS confirms who's signed in.
AWS Agent Toolkit and the AWS MCP server: give our AI coding assistant AWS skills and guidance while we build.
Built, running locally (not deployed yet)

Amazon Location Service: map tiles, real road routes with distance and drive time, and geocoding for places riders type in. The browser uses an API key that only allows read-only map, route and place calls from localhost and the CloudFront site.
AWS AppSync Events: carries the driver's live location to the rider over a WebSocket, one channel per ride (`/rides/<random id>`).
Amazon Cognito: real school-email sign-in. Cognito emails each student a 6-digit code to verify their address, and an AWS Lambda pre-sign-up check rejects any email that isn't @gcsu.edu or @bobcats.gcsu.edu, even if someone calls the sign-up API directly. Defined in `auth.yaml`; `setup-live-map.sh` deploys it.
Next step (designed, not built yet)

Amazon DynamoDB: Users, Drivers and Rides tables.
AWS Lambda and Amazon API Gateway: run the driver-matching score (past rides, payment compatibility, distance) on the server.
Amazon SNS: texts drivers when a ride is requested.

### 1. Connect to your school
- The student picks their school first. For the demo, the only option is **Georgia College & State University**.
- New students choose **Create account** and enter their school email, name and a password. Only `@gcsu.edu` and `@bobcats.gcsu.edu` addresses are accepted, checked both in the app and on AWS.
- Amazon Cognito emails a 6-digit code, and they enter it to prove the address is theirs. **Send a new code** resends it.
- After that they **Log in** with email and password. **Forgot your password?** emails a code to set a new one.
- Without Cognito set up (no `config.js`, or opening the file directly), the app falls back to a demo sign-in that shows the code on screen.
- Every user is a verified student, and students are only matched with people from their own school.

### 2. Request a ride
- The rider types a pickup and drop-off as free text. The app finds the place and shows the distance and drive time by road. (Without map setup, only known campus and town stops get a straight-line estimate.)
- They pick how they can pay: **Cash App, Venmo or PayPal**.
- They see how many drivers are available to drive right now.
- Optionally, they can request a driver they've ridden with before.
- **Find my driver** matches them with a driver automatically.

### 3. Automatic matching
Each online driver with an open seat gets a score. The highest score wins:

| Factor | Effect |
|---|---|
| Rider requested this driver | Strong boost |
| Past rides together | Boost, more for each ride and for a higher average rating |
| Driver accepts one of the rider's payment methods | Boost; a driver with no matching method is ranked lower |
| Driver is close to the pickup | Small boost, decreasing with distance |

The match screen explains why that driver was picked, for example "1 past ride together, 5.0 stars. Takes Venmo."

### 4. Matched ride
- A status card follows the driver from matched to on the way, arriving and here.
- A map shows the pickup, the drop-off, the road route and the driver's car. Until the driver shares their location, the car follows a simulated estimate.
- **Live location:** the ride screen has a driver link. Opening it shows a driver screen for that ride only, where the driver can **share their live location** (phone GPS) or **simulate the drive** along the real route (for demos away from Milledgeville). The rider's map and ETA follow the car. Sharing stops when the driver taps Stop or the rider finishes or cancels the ride, and locations are never stored.
- The ride card shows the driver's name, car and ETA, plus a **ride code** (for example, `GC-2529`). The driver says the code before the rider gets in, so the rider knows it's the right car.
- The rider can message the driver, see which of the driver's payment methods match theirs, and **share the trip** with a friend.

### 5. Payment (outside the app)
- Money moves directly between the rider and driver in Cash App, Venmo or PayPal.
- GClifts **only records** which method was used. This keeps the app out of payment processing and liability.
- The driver confirms in GClifts when the money arrives, so riders who don't pay are easy to spot.

### 6. Finish the ride
- The rider records how they paid and taps 1 to 5 stars to rate the ride. A rating is required, because it feeds future matches.
- They can **leave a review**: an optional note of up to 280 characters about the driver.
- The ride is saved to their ride log as "Waiting for driver" until the driver confirms the payment. (Sample drivers confirm after a few seconds.)

### 7. Drive
- A driver sets whether they're available now, their car, open seats, general area, and which payment methods they prefer.
- **Your riders** lists each rider they've driven, with the trip, how the rider paid, and the rider's stars and review. The driver taps **Confirm payment received** when the money shows up, and can message each rider.
- A driver can **report a rider** from the rider's card: Didn't pay, Too loud, Threw up or Other, with an optional note (required for Other). Riders don't see reports. In the demo, a report is saved with the ride; in production it would go to GClifts for review.
- A new driver starts with two sample riders, one of whom is waiting for a payment confirmation, so the demo shows this right away.

### 8. Ride log
- A summary line, for example: "3 rides with 2 drivers. You pay with Venmo most often."
- **Drivers you've ridden with:** number of rides, what you paid with, and what they prefer.
- **Every ride:** date, trip, driver, payment method, whether the driver confirmed it, rating and review.
- **Reset my sample rides** restores the sample rides and keeps the rider's own rides.
- Past drivers are matched first on future rides.

### 9. Log out
- **Log out** is in the header on every screen and takes you back to choosing your school.
- If a ride is in progress, finish or cancel it first.

## Data model

| Table | Key fields |
|---|---|
| **Users** | email (key), name, school |
| **Drivers** | id, email, car, seats, zone, pay[], online |
| **Rides** | id, riderEmail, riderName, driverId, from, to, when, paidWith, confirmed, rating, review, report, code, chat[] |

## Demo stops (Milledgeville)

Russell Library, Maxwell Student Union, Student Health Center, The Village apts, Walmart Supercenter, Kroger, CVS Pharmacy, Downtown Milledgeville, Bus Station, Airport shuttle stop. Riders can also type any other place.

## Current build

- One page, `index.html`, with plain JavaScript, styled with **[Tailwind CSS](https://tailwindcss.com) v4**. The map uses [MapLibre GL JS](https://maplibre.org) 4.7.1 from a CDN. The only backend is Location Service and AppSync Events, called straight from the browser.
- Data is saved in the browser. Each rider gets their own copy of the sample rides the first time they sign in; **Reset my sample rides** in the Ride log tab restores them. Each new driver gets two sample riders.
- Tested on phone (375px), tablet (820px) and laptop (1366px) widths, in light and dark mode.

### Try it

The compiled stylesheet, `styles/app.css`, is committed, so you don't need to install anything to run the app.

1. Create the map, live-tracking and sign-in resources and write `config.js` (once, after `aws login`). The script reuses anything that already exists, and updates the sign-in stack if `auth.yaml` changed:
   ```bash
   bash setup-live-map.sh
   ```
2. Serve the folder. The map key only works from `http://127.0.0.1:8000` or `:8001` (or `localhost`), so opening the file directly shows no map:
   ```bash
   python3 -m http.server 8000 --bind 127.0.0.1
   ```
3. Open http://127.0.0.1:8000. To play the driver, copy the driver link from a matched ride and open it in another tab.

### Deploy

The site is served from the private S3 bucket `gclifts-site-645674817154` through CloudFront distribution `EFJ3FGX7Q0OQK` (https://d3exvjki5n2jnm.cloudfront.net). The Location key already allows that address. `config.js` isn't in git, so upload it from your machine with the other files:

```bash
npm run build
```
```bash
aws s3 cp index.html s3://gclifts-site-645674817154/index.html --content-type "text/html; charset=utf-8" --cache-control no-cache
```
```bash
aws s3 cp styles/app.css s3://gclifts-site-645674817154/styles/app.css --content-type "text/css; charset=utf-8" --cache-control no-cache
```
```bash
aws s3 cp config.js s3://gclifts-site-645674817154/config.js --content-type "application/javascript; charset=utf-8" --cache-control no-cache
```
```bash
aws cloudfront create-invalidation --distribution-id EFJ3FGX7Q0OQK --paths "/" "/index.html" "/styles/app.css" "/config.js"
```

Check it worked: `curl -s https://d3exvjki5n2jnm.cloudfront.net/config.js | head -2` should print the "Written by setup-live-map.sh" comment, not HTML. (CloudFront answers missing files with `index.html`, so a missing `config.js` doesn't show up as a 404.) You only need to upload `config.js` again after re-running `setup-live-map.sh` creates new keys. The AppSync key expires after 365 days.

Without `config.js` the app still runs, with straight-line estimates, no map or live tracking, and the demo sign-in. Sharing real GPS from a phone needs the site on HTTPS, because browsers only give location to secure pages.

### Sign-in with Amazon Cognito

`setup-live-map.sh` deploys `auth.yaml` as the CloudFormation stack `gclifts-auth` in us-east-2 and adds `userPoolId` and `clientId` to `config.js`. Both IDs are public by design; they identify the user pool but don't grant access to anything.

- **Emails:** Cognito sends the codes itself, so there's no Amazon SES setup, but it's limited to a small number of emails per day. For a real launch, switch `EmailConfiguration` in `auth.yaml` to a verified SES address.
- **Passwords:** at least 8 characters, with a lowercase letter and a number. The browser sends them to Cognito over HTTPS (`USER_PASSWORD_AUTH`).
- **Security headers:** if the CloudFront distribution sets a Content-Security-Policy, its `connect-src` must allow `https://cognito-idp.us-east-2.amazonaws.com`, or sign-in fails.
- **What it doesn't do yet:** the app keeps its data in the browser, so signing in proves who you are, but rides aren't stored on a server under your account.
- **Removing it:** `aws cloudformation delete-stack --stack-name gclifts-auth --region us-east-2` deletes the user pool and every account in it.

### How it adapts to each device

The app is one centered column at every size, limited to a comfortable reading width.

| Screen | Layout |
|---|---|
| Phones (under 640px) | The tabs fill the width and stay at the top while you scroll. The ride log shows each ride as a card instead of a table, and the trip chat fits the screen width. Form fields are stacked. |
| Tablets, laptops and desktops (640px and up) | Form fields sit side by side, and the ride log becomes a table. |

Every size also:
- Has buttons and chips at least 44px tall, so they're easy to tap.
- Uses 16px text in form fields, so iPhones don't zoom in when you tap one.
- Respects the safe areas around a phone's notch and home bar.
- Follows the device's light or dark setting. Set `data-theme="light"` or `data-theme="dark"` on `<html>` to force one.
- Has no decorative animation. The ride progress bar fills in steps, so it reads the same with reduced motion turned on.

### Changing the styles

Styling is done with Tailwind utility classes in `index.html`, including the class strings inside the `<script>` (shared sets live in the `UI` object). The colors (`ground`, `panel`, `ink`, `soft`, `rule`, `permit`, `route`, `campus`, `alert`) and the two fonts are defined once in `styles/input.css`, and dark mode changes the colors there.

Tailwind only puts the classes it finds into `styles/app.css`, so rebuild after adding or changing classes:

```bash
npm install
npm run dev     # rebuilds styles/app.css on every save
npm run build   # one-off minified build; commit styles/app.css afterwards
```

Write class names out in full (for example `"bg-route"`, not `"bg-" + color`); Tailwind can't find names built from pieces.

### Files

| File | What it is |
|---|---|
| `index.html` | The app: markup, Tailwind classes and JavaScript |
| `styles/input.css` | Tailwind source: color tokens, dark mode, fonts |
| `styles/app.css` | Compiled Tailwind output that `index.html` loads (generated; don't edit by hand) |
| `package.json` | Tailwind CLI and the `build` and `dev` scripts |
| `images/logo.jpg` | The GClifts logo in the app header (resized from the banner above) |
| `images/icon.png` | The bobcat emblem, used as the browser tab and home-screen icon |
| `setup-aws.sh` | AWS CLI and Agent Toolkit setup |
| `setup-live-map.sh` | Creates the Location Service key, the AppSync Events API and the Cognito sign-in in us-east-2, then writes `config.js` |
| `auth.yaml` | CloudFormation template for sign-in: the Cognito user pool, the school-email check and the website's client |
| `config.js` | Browser keys and endpoints for the map, live tracking and sign-in (generated, not committed) |
| `server/`, `template.yaml` | A WebSocket backend (API Gateway, Lambda, DynamoDB) for matching and chat across phones. Built and tested locally, not connected to the site or deployed |

## AWS architecture (next step)

| Need | Service |
|---|---|
| School-email sign-in | **Cognito**, with a pre-signup Lambda that rejects any email not ending in `@gcsu.edu` or `@bobcats.gcsu.edu` (built: `auth.yaml`) |
| Data | **DynamoDB**: Users, Drivers and Rides tables |
| Matching | **Lambda** running the scoring logic above, behind **API Gateway** |
| Maps and addresses | **Amazon Location Service** for map tiles, geocoding and road routes (built) |
| Live driver location | **AppSync Events**, one channel per ride (built; can switch from API key to Cognito auth now that sign-in exists) |
| Ride alerts | **SNS** text messages to drivers when a ride is requested |
| Hosting | **S3** and **CloudFront**, or **Amplify Hosting** |

Region: the project is in `us-east-2`; the Agent Toolkit runs in `us-east-1`.

## Out of scope for the MVP

- Matching a real driver's account to a ride (the driver joins by link, and matched drivers are still samples)
- In-app payments
- Driver background checks and insurance verification
- Schools other than GCSU

## Demo script (2 minutes)

1. **The problem:** "Maria is a GC freshman with no car and a prescription to pick up at CVS. The GroupMe ride chat is chaos."
2. **Connect to school:** choose Georgia College & State University and create an account with a `@bobcats.gcsu.edu` email. Show that a non-GC email is rejected, then enter the 6-digit code.
3. **Request:** Maxwell Student Union to CVS Pharmacy, paying with Venmo.
4. **Match:** point out the ride code, the reason this driver was picked, the matching payment method and the status card moving from on the way to here. Send the driver a message.
5. **Finish:** record Venmo, tap 5 stars and leave a short review, then open the ride log and watch the payment change to Confirmed.
6. **Drive:** open the Drive tab, save a driver profile, confirm Maya's payment and message her.
7. **Close:** "Students helping students get to the trips that matter. Next, we store rides in DynamoDB so riders and drivers connect across phones."

## Judging fit

- **Completion:** every step from sign-in through matching, the ride and the ride log works.
- **Originality:** limited to one school, matching that favors drivers you've ridden with, and a ride code to check the car.
- **Design:** a single-column layout built with Tailwind CSS that adapts to phones, tablets and laptops, in light and dark mode.
- **Technical:** scored matching that uses ride history, payment compatibility and distance.
- **Social good:** access to food, medicine, healthcare and jobs for students without cars.
