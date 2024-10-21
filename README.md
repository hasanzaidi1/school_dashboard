# Student, Teacher and Guardian Management System

A web-based application built with Node.js, Express, PostgreSQL, and bcrypt for managing students, teachers, and parent accounts in an educational institution. The system allows administrators to register students, manage teacher and substitute teacher data, and provides parents with a portal to view and register their children.

## Features

- **Admin Portal**: Secure login for administrators to manage student data and access teacher records.
- **Teacher Portal**: Login system for teachers to access their portal.
- **Substitute Teacher Management**: Registration and management of substitute teachers with email validation.
- **Parent Portal**: Allows parents to register and view their students' details. Parents can log in using their own accounts to manage their children's data.
- **Session and Cookie-based Authentication**: Sessions for user login, along with optional 'Remember Me' functionality using cookies.
- **Password Security**: All passwords are securely hashed using bcrypt.

## Technologies Used

- Node.js
- Express
- PostgreSQL
- bcrypt for password hashing
- express-session and cookie-parser for session and cookie management
- body-parser for handling JSON and URL-encoded form submissions
- dotenv for environment variable management

## Setup Instructions

1. Clone the repository.
   ```bash
   git clone https://github.com/hasanzaidi1/school_dashboard.git
2. Navigate into the project directory:
   ```bash
    cd student-teacher-management
3. Install the dependencies:
   ```bash
    npm install
4. Set up your PostgreSQL database and environment variables using a .env file:
   ```bash
   DB_USER=your_username
   DB_PASS=your_password
   DB_HOST=your_host
   DB_NAME=your_database_name
   DB_PORT=5432

5. Run the application:
   ```bash
   npm start

The server will be running at http://localhost:3000.

