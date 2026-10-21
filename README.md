# GClifts MVP

A students-only ride-share for Georgia College & State University. Students  get rides from verified classmates to the places that matter.
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
- puts the writer and driver in a direct message chat 
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
| **Drivers** | id, email, car, seats, major, year, zone, pay[], online |
| **Rides** | id, riderEmail, driverId, from, to, purpose, when, paidWith, rating, code |

## Demo stops (Milledgeville)

Russell Library, Maxwell Student Union, Student Health Center, The Village apts, Walmart Supercenter, Kroger, CVS Pharmacy, Downtown Milledgeville, Bus Station, Airport shuttle stop. Riders can also type any other place.

## Current build

- A single file, `index.html`, with plain HTML, CSS and JavaScript and no backend.
- Data is saved in the browser and starts with sample drivers and rides. **Reset sample data** in the Ride log tab restores them.
- Tested at laptop and phone widths, in light and dark mode.

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
- **Design:** map-first layout, works on phones, light and dark mode.
- **Technical:** scored matching that uses ride history, payment compatibility and distance.
- **Social good:** access to food, medicine, healthcare and jobs for students without cars.
