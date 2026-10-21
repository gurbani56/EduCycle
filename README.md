
# EduCycle

**Educational Resource Reuse and Exchange Platform**

EduCycle is a campus platform that allows students to donate, lend, borrow, and exchange educational resources such as textbooks, notes, calculators, electronics, and lab equipment. It promotes affordable education, resource sharing, and sustainability by encouraging students to reuse academic materials.

## Features

- Browse, search, filter, and sort available resources.
- Create, edit, and manage resource listings.
- Request resources and track exchange status.
- Post resource requirements on the community request board.
- Manage pickup locations and submit grievances.
- Receive notifications and view activity history.
- Admin dashboard for managing users, resources, requests, locations, and grievances.

## Technology Stack

- **Frontend:** HTML5, CSS3, Bootstrap, JavaScript
- **Backend:** Node.js, Express.js
- **Database:** MongoDB with Mongoose
- **Authentication:** Express sessions and bcryptjs

## Project Structure

```text
EduCycle/
├── frontend/
│   ├── *.html
│   └── assets/
│       ├── css/
│       ├── js/
│       ├── img/
│       └── vendor/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   ├── scripts/
│   └── data/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## Objective

EduCycle aims to make educational resources more accessible and affordable while reducing waste through reuse, sharing, and collaboration among students.
