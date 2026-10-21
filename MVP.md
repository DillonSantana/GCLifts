# GClifts MVP

A students-only ride-share for Georgia College & State University. Students without cars get rides from classmates who sign in with their school email to the places that matter: groceries, the pharmacy, the clinic, a job interview.

**Track:** Community & Wellbeing (AWS for Social Good)

## Problem

Many GC students don't have a car. Milledgeville has limited public transit, and rideshare apps are expensive and unreliable in a small town. Students skip grocery runs, prescriptions and appointments because they can't get there.

## Who it helps

- **Riders:** students without a car, especially first-years and students on a tight budget.
- **Drivers:** students with a car who want a little gas money and to help classmates.

## What the MVP does

### 1. Connect to your school
- The student picks their school first. For the demo, the only option is **Georgia College & State University**.
- Then they enter their school email. Only `@gcsu.edu` and `@bobcats.gcsu.edu` addresses are accepted.
- Every user signs in with a school email, and students are only matched with people from their own school.
- The demo only checks the email's domain. Real verification (a sign-in code sent to that address) comes with Cognito.

### 2. Request a ride
- The rider types a pickup and drop-off as free text. Known campus and town stops appear on the map with a distance and drive time. Other places are accepted, but the demo shows no distance or drive time for them until Location Service is connected.
- They pick the trip's purpose: Groceries, Pharmacy, Clinic, Job interview, Class, or Other.
  - Groceries, Pharmacy, Clinic and Job interview count as **essential trips**. Drivers hold their last open seat for them: other trips are only matched with drivers who have at least two open seats.
- They pick how they can pay: **Cash App, Venmo or PayPal**.
- Optionally, they can request a driver they've ridden with before.
- **Find my driver** matches them with a driver automatically.

### 3. Automatic matching
Online drivers with an open seat are eligible (at least two open seats for non-essential trips). Each eligible driver gets a score, and the highest score wins:

| Factor | Effect |
|---|---|
| Rider requested this driver | Strong boost |
| Past rides together | Boost, more for each ride and for a higher average rating |
| Driver accepts one of the rider's payment methods | Boost; a driver with no matching method is ranked lower |
| Driver is close to the pickup | Small boost, decreasing with distance (skipped when the pickup isn't on the demo map) |

The match screen explains why that driver was picked, for example "1 past ride together, 5.0 stars. Takes Venmo."

### 4. Matched ride: the hang tag
- A yellow parking-permit-style tag shows a **ride code** (for example, `GC-2529`). The driver says the code before the rider gets in, so the rider knows it's the right car.
- It shows the driver's name, car and year, plus an ETA.
- It shows the driver's payment preferences, highlighting the ones that match the rider's.
- **Share your trip** copies the driver, car, route and ride code so the rider can send them to a friend.

### 5. Payment (outside the app)
- Money moves directly between the rider and driver in Cash App, Venmo or PayPal.
- GClifts **only records** which method was used. This keeps the app out of payment processing and liability.

### 6. Finish the ride
- The rider records how they paid and rates the ride from 1 to 5 stars.
- The ride is saved to their ride log.

### 7. Drive
- A driver sets whether they're available now, their car, open seats, year, usual area, and which payment methods they prefer.

### 8. Ride log
- A summary line, for example: "3 rides with 2 drivers. You pay with Venmo most often."
- **Drivers you've ridden with:** number of rides, what you paid with, and what they prefer.
- **Every ride:** date, trip, purpose, driver, payment method and rating.
- Past drivers are matched first on future rides.

## Data model

| Table | Key fields |
|---|---|
| **Users** | email (key), name, school |
| **Drivers** | id, email, car, seats, year, zone, pay[], online |
| **Rides** | id, riderEmail, driverId, from, to, purpose, when, paidWith, rating, code |

## Demo stops (Milledgeville)

Russell Library, Maxwell Student Union, Student Health Center, The Village apts, Walmart Supercenter, Kroger, CVS Pharmacy, Downtown Milledgeville, Bus Station, Airport shuttle stop. Riders can also type any other place.

## Current build

- A single file, `index.html`, with plain HTML, CSS and JavaScript and no backend.
- Data is saved in the browser and starts with sample drivers. Each rider who signs in gets their own copy of three sample rides, and their ride log and ratings are kept separate from anyone else using the same browser. **Reset my sample rides** in the Ride log tab restores them.
- While a ride is active, it uses one of the driver's open seats.
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
- **Originality:** limited to one school, essential trips get the last open seat, and the hang-tag ride code.
- **Design:** map-first layout, works on phones, light and dark mode.
- **Technical:** scored matching that uses ride history, payment compatibility and distance.
- **Social good:** access to food, medicine, healthcare and jobs for students without cars.
