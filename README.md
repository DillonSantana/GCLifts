# GClifts MVP

A students-only ride-share for Georgia College & State University. Students get rides from verified classmates to the places that matter.

**Track:** Community & Wellbeing (AWS for Social Good)

## Problem

Milledgeville has limited public transit, and no rideshare apps are available. Students created a huge GroupMe group chat that has its own challenges, some members of the group chat are not part of the college some riders don't pay the driver, and sometimes the group chat is too chaotic to get a driver.

## Who it helps

- **Riders:** Automatically connects riders with drivers, and drivers are verified students. 
- **Drivers:** automatically connects with riders, and it's verified your pay. You can chat with the people you match with.

## What the MVP does

### 1. Connect to your school
- The student picks their school first. For the demo, the only option is **Georgia College & State University**.
- The app sends a verification email to verify the email is a real email (if possible within timeframe)
- Then they enter their school email. Only `@gcsu.edu` and `@bobcats.gcsu.edu` addresses are accepted.
- Every user is a verified student, and students are only matched with people from their own school.

### 2. Request a ride
- The rider types a pickup and drop-off as free text. 
- They pick how they can pay: **Cash App, Venmo or PayPal**.
- Optionally, they can request a driver they've ridden with before.
- **Find my driver** matches them with a driver automatically. Who is available to drive 

### 3. Automatic matching
Each online driver with an open seat gets a score. The highest score wins:

| Factor | Effect |
|---|---|
| Rider requested this driver | Strong boost |
| Past rides together | Boost, more for each ride and for a higher average rating |
| Driver accepts one of the rider's payment methods | Boost; a driver with no matching method is ranked lower |
| Driver is close to the pickup | Small boost, decreasing with distance |

The match screen explains why that driver was picked, for example "1 past ride together, 5.0 stars. Takes Venmo."

### 4. Matched ride: the hang tag
- the rider gets an Uber-style match with the location of the driver on their way there
- puts the rider and driver in a direct message chat 
- A yellow parking-permit-style tag shows a **ride code** (for example, `GC-2529`). The driver says the code before the rider gets in, so the rider knows it's the right car.
- It shows the driver's name, car, plus an ETA.
- It shows the driver's payment preferences, highlighting the ones that match the rider's.
- **Share your trip** copies the driver, car, route and ride code so the rider can send them to a friend.

### 5. Payment (outside the app)
- Money moves directly between the rider and driver in Cash App, Venmo or PayPal.
- GClifts **only records** which method was used. This keeps the app out of payment processing and liability.

### 6. Finish the ride
- The rider records how they paid and rates the ride from 1 to 5 stars.
- The ride is saved to their ride log.

### 7. Drive
- A driver sets whether they're available now, their car, open seats, general area, and which payment methods they prefer.

### 8. Ride log
- A summary line, for example: "3 rides with 2 drivers. You pay with Venmo most often."
- **Drivers you've ridden with:** number of rides, what you paid with, and what they prefer.
- **Every ride:** date, trip, purpose, driver, payment method and rating.
- Past drivers are matched first on future rides.

## Data model

| Table | Key fields |
|---|---|
| **Users** | email (key), name, school |
| **Drivers** | id, email, car, seats, zone, pay[], online |
| **Rides** | id, riderEmail, driverId, from, to, purpose, when, paidWith, rating, code |

## Demo stops (Milledgeville)

Russell Library, Maxwell Student Union, Student Health Center, The Village apts, Walmart Supercenter, Kroger, CVS Pharmacy, Downtown Milledgeville, Bus Station, Airport shuttle stop. Riders can also type any other place.

## Current build

- One page, `index.html`, with plain JavaScript and no backend, styled with **[Tailwind CSS](https://tailwindcss.com) v4**.
- Data is saved in the browser. Each rider gets their own copy of the sample rides the first time they sign in; **Reset my sample rides** in the Ride log tab restores them.
- Tested on phone (375px), tablet (820px) and laptop (1366px) widths, in light and dark mode.

### Try it

Open `index.html` in a browser. The compiled stylesheet, `styles/app.css`, is committed, so you don't need to install anything to run the app.

### How it adapts to each device

| Screen | Layout |
|---|---|
| Phones (under 640px) | The map sits above the app. The tabs fill the width and stay at the top while you scroll. The ride log shows each ride as a card instead of a table, and the trip chat fits the screen width. Form fields are stacked. |
| Tablets (640px to 1023px) | The map is still on top, and the column is limited to a comfortable reading width. Form fields sit side by side, and the ride log becomes a table. |
| Laptops and desktops (1024px and up) | The map is on the left and stays in view while you scroll; the app is on the right. |

Every size also:
- Has buttons and chips at least 44px tall, so they're easy to tap.
- Uses 16px text in form fields, so iPhones don't zoom in when you tap one.
- Respects the safe areas around a phone's notch and home bar.
- Follows the device's light or dark setting. Set `data-theme="light"` or `data-theme="dark"` on `<html>` to force one.
- Skips the hang-tag swing animation when the device asks for reduced motion.

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
| `styles/input.css` | Tailwind source: color tokens, dark mode, fonts, the hang-tag animation |
| `styles/app.css` | Compiled Tailwind output that `index.html` loads (generated; don't edit by hand) |
| `package.json` | Tailwind CLI and the `build` and `dev` scripts |
| `setup-aws.sh` | AWS CLI and Agent Toolkit setup |

## AWS architecture (next step)

| Need | Service |
|---|---|
| School-email sign-in | **Cognito**, with a pre-signup Lambda that rejects any email not ending in `@gcsu.edu` or `@bobcats.gcsu.edu` |
| Data | **DynamoDB**: Users, Drivers and Rides tables |
| Matching | **Lambda** running the scoring logic above, behind **API Gateway** |
| Maps and addresses | **Amazon Location Service** for geocoding the free-text stops and calculating distance and ETA |
| Ride alerts | **SNS** text messages to drivers when an essential trip is requested |
| Hosting | **S3** and **CloudFront**, or **Amplify Hosting** |

Region: the project is in `us-east-2`; the Agent Toolkit runs in `us-east-1`.

## Out of scope for the MVP

- Live GPS tracking (the map animation is simulated)
- In-app payments
- Driver background checks and insurance verification
- Schools other than GCSU

## Demo script (2 minutes)

1. **The problem:** "Maria is a GC freshman with no car and a prescription to pick up at CVS."
2. **Connect to school:** choose Georgia College & State University and sign in with a `@bobcats.gcsu.edu` email. Show that a non-GC email is rejected.
3. **Request:** Maxwell Student Union to CVS Pharmacy, purpose Pharmacy (an essential trip), paying with Venmo.
4. **Match:** the hang tag appears. Point out the ride code, the reason this driver was picked, and the matching payment method.
5. **Finish:** record Venmo and 5 stars, then open the ride log.
6. **Close:** "Students helping students get to the trips that matter. Next, we put it on Cognito, DynamoDB and Location Service."

## Judging fit

- **Completion:** every step from sign-in through matching, the ride and the ride log works.
- **Originality:** limited to one school, essential trips come first, and the hang-tag ride code.
- **Design:** map-first layout built with Tailwind CSS that adapts to phones, tablets and laptops, in light and dark mode.
- **Technical:** scored matching that uses ride history, payment compatibility and distance.
- **Social good:** access to food, medicine, healthcare and jobs for students without cars.
