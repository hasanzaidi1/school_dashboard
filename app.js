const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser'); // Import cookie-parser
const { Pool } = require('pg'); // Import pg library for PostgreSQL
const app = express();
const path = require('path');

const cors = require('cors');
const { table } = require('console');
app.use(cors());

require('dotenv').config();

// Middleware to parse JSON and URL-encoded data
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files like HTML/CSS/JS
app.use(express.static('public'));

// Cookie parser middleware
app.use(cookieParser());

// Session middleware
app.use(session({
    secret: 'your_secret_key',  // Replace with a more secure key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }  // For production, set 'secure: true' if using HTTPS
}));

// PostgreSQL connection setup
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: process.env.DB_PORT,
});
pool.connect()
    .then(client => {
        console.log("Connected to the database");
        client.release();
    })
    .catch(err => console.error("Database connection error", err.stack));


// Dummy admin credentials (replace with a database lookup in production)
const adminUser = {
    username: process.env.user,
    password: process.env.pass
};

// ++++++ Teachers Portal +++++++++

// Dummy teacher credentials (replace with a database lookup in production)
const teacherUser = {
    username: process.env.user,
    password: process.env.pass
};

app.post('/teacher-login', (req, res) => {
    const { username, password } = req.body;

    console.log('Received credentials:', { username, password });
    console.log('Current session state:', req.session);

    if (username === teacherUser.username && password === teacherUser.password) {
        req.session.isLoggedIn = true;
        console.log('Login successful, session state:', req.session);
        return res.redirect('/teachers/teacher_portal.html'); // This should work now
    } else {
        console.log('Login failed for:', username);
        return res.status(401).send('Invalid username or password. Please try again.');
    }
});

app.get('/teacher_portal.html', (req, res) => {
    if (req.session.isLoggedIn) {
        res.sendFile(path.join(__dirname, 'public', 'teacher.html'));
    } else {
        res.redirect('/teacher-login'); // Ensure this route exists
    }
});


app.get('/fetch-teachers', async (req, res) => {
    const query = `
        SELECT 
            CONCAT_WS(' ', teachers."t_f_name", teachers."t_mi", teachers."t_l_name") AS full_name,
            teachers."t_email", 
            teachers."t_phone" 
        FROM teachers;
    `;
    
    try {
        const result = await pool.query(query); // Execute the query
        res.json({ teachers: result.rows }); // Send the result as JSON
    } catch (error) {
        console.error('Error fetching teachers:', error);
        res.status(500).json({ message: 'Error fetching teachers' });
    }
});


// ++++++++++

//  Subs Teachers  


app.post('/register-substitute', async (req, res) => {
    const { sub_f_name, sub_l_name, sub_email, sub_phone } = req.body;

    try {
        // Check if a substitute with the same email already exists
        const existingSub = await pool.query('SELECT * FROM substitute WHERE sub_email = $1', [sub_email]);

        if (existingSub.rows.length > 0) {
            return res.status(400).json({ message: 'Substitute with this email already exists.' });
        }

        // Insert the new substitute if no existing substitute found
        const result = await pool.query(
            'INSERT INTO substitute (sub_f_name, sub_l_name, sub_email, sub_phone) VALUES ($1, $2, $3, $4) RETURNING *',
            [sub_f_name, sub_l_name, sub_email, sub_phone]
        );

        res.status(201).json({ substitute: result.rows[0] });
    } catch (error) {
        console.error('Error registering substitute:', error);
        res.status(500).json({ message: 'Error registering substitute' });
    }
});



app.get('/fetch-substitutes', async (req, res) => {
    const query = 'SELECT sub_f_name, sub_l_name, sub_email, sub_phone FROM substitute;';
    
    try {
        const result = await pool.query(query);
        res.json({ substitutes: result.rows });
    } catch (error) {
        console.error('Error fetching substitutes:', error);
        res.status(500).json({ message: 'Error fetching substitutes' });
    }
});



// ++++++++++


// +++++ Parents Portal +++++++

// Registration endpoint
app.post('/register-parent', async (req, res) => {
    const { username, email, password } = req.body;

    // Hash the password before storing it
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        // Insert new guardian into the database
        await pool.query('INSERT INTO parent_account (username, email, password) VALUES ($1, $2, $3)', [username, email, hashedPassword]);
        
        // Redirect to the login page after successful registration
        res.redirect('parents/parents_login.html'); // Adjust the path as needed
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Parent login endpoint
app.post('/parent-login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Query the database for the user
        const result = await pool.query('SELECT * FROM parent_account WHERE username = $1 or email = $1', [username]);
        const user = result.rows[0]; // Assuming username is unique

        if (user && await bcrypt.compare(password, user.password)) {
            res.redirect("parents/parents_portal.html")
        } else {
            res.status(401).send('Invalid credentials');
        }
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Route to register a student from parent portal
app.post('/register-from-parent', async (req, res) => {
    const {
        fname,
        MI,
        lname,
        DOB,
        st_address,
        city,
        state,
        zip,
        st_email,
        st_cell,
        student_location,
        gender,
        relation,
        // Accessing parent names using bracket notation
        'parent-first-name': parentFirstName,
        'parent-last-name': parentLastName,
        parent_st_address,
        parent_city,
        parent_state,
        parent_zip,
        parent_cell,
        parent_email,
    } = req.body;

    console.log(req.body);
    

    try {
        
        // Insert student into the student table
        const studentQuery = `
            INSERT INTO student ("F_Name", "MI", "L_Name", "dob", "st_address", "city", "state", "zip", "st_email", "st_cell", "st_gender", "student_location")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING "St_ID"
        `;
        const studentValues = [
            fname,
            MI,
            lname,
            DOB,
            st_address,
            city,
            state,
            zip,
            st_email,
            st_cell,
            gender,
            student_location,
        ];
        const studentResult = await pool.query(studentQuery, studentValues);
        const studentId = studentResult.rows[0].St_ID;

        // Insert guardian into the guardian table
        const guardianQuery = `
            INSERT INTO guardian (g_f_name, g_mi, g_l_name, g_cell, g_email, g_staddress, g_city, g_state, g_zip)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING g_id
        `;
        const guardianValues = [
            parentFirstName,
            '', // Assuming you don't need the MI
            parentLastName,
            parent_cell,
            parent_email,
            parent_st_address,
            parent_city,
            parent_state,
            parent_zip,
        ];
        const guardianResult = await pool.query(guardianQuery, guardianValues);
        const guardianId = guardianResult.rows[0].g_id;

        // Insert into student_guardian relationship table
        const relationQuery = `
            INSERT INTO student_guardian (st_id, g_id, relationship_type)
            VALUES ($1, $2, $3)
        `;
        const relationValues = [studentId, guardianId, relation];
        await pool.query(relationQuery, relationValues);

        res.status(201).json({ message: 'Student registered successfully!' });
        
    } catch (error) {
        console.error('Error registering student:', error);
        res.status(500).json({ error: 'Failed to register student.' });
    }
});

// Route to get registered student(s) under a parents email
app.post('/students-by-parent', async (req, res) => {
    const { parent_email } = req.body;

    try {
        const query = `
            SELECT s.*
            FROM student s
            JOIN student_guardian sg ON s."St_ID" = sg."st_id"
            JOIN guardian g ON g."g_id" = sg."g_id"
            WHERE g."g_email" = $1
        `;
        
        const values = [parent_email];
        const result = await pool.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'No students found for this email.' });
        }

        res.json(result.rows);
        
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ error: 'Failed to fetch student information.' });
    }
});



// +++++++++


// Middleware to check if the user is logged in as admin
function isAuthenticated(req, res, next) {
    console.log('Session:', req.session); // Log session details
    console.log('Cookies:', req.cookies); // Log cookie details

    if (req.session.isAdmin || req.cookies.username) {
        return next();
    } else {
        return next();
        // console.log('Not authenticated, redirecting to login.'); // Log redirect action
        // res.redirect('/login');  // Redirect to login if not authenticated
    }
}

// Admin login route
app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/public/admin-login.html');  // Serve admin login.html
});

app.post('/login', (req, res) => {
    const { username, password, remember } = req.body;

    // Check if credentials match
    if (username === adminUser.username && password === adminUser.password) {
        req.session.isAdmin = true;  // Set the session to indicate admin is logged in
        console.log('Admin logged in. Session:', req.session); // Log session details after login

        if (remember) {
            // Set a cookie for 30 days if "Remember Me" is checked
            res.cookie('username', username, { maxAge: 30 * 24 * 60 * 60 * 1000 }); // 30 days
        }

        res.redirect('/admin.html');  // Redirect to admin.html after successful login
    } else {
        res.send('Invalid credentials. Please try again.');
    }
});

// Serve the students page (Protected route)
app.get('/students', isAuthenticated, (req, res) => {
    res.sendFile(__dirname + '/public/students.html');  // Serve students.html file
});

// Student registration route (only admins can access)
app.post('/register', isAuthenticated, async (req, res) => {
    const { 
        fname,
        MI,
        lname,
        DOB,
        st_address,
        city,
        state,
        zip, // Now a text field
        st_email,
        st_cell, // Now a text field
        student_location,
        gender
    } = req.body;

    console.log(`
        Student First Name: ${fname}, 
        Middle Initial: ${MI}, 
        Student Last Name: ${lname}, 
        Date of Birth: ${DOB}, 
        Address: ${st_address}, 
        City: ${city}, 
        State: ${state}, 
        Zip: ${zip}, 
        Email: ${st_email}, 
        Cell: ${st_cell}, 
        Location: ${student_location},
        Gender: ${gender}`);

    try {
        const query = `
            INSERT INTO student ("F_Name", "MI", "L_Name", dob, "st_address", city, state, zip, "st_email", "st_cell", "student_location", "st_gender")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;
        const values = [
            fname,
            MI,
            lname,
            DOB,
            st_address,
            city,
            state,
            zip, // Expecting this as a string now
            st_email,
            st_cell, // Expecting this as a string now
            student_location,
            gender
        ];

        await pool.query(query, values);
        res.json({ message: 'Student registered successfully!' });
    } catch (error) {
        console.error('Error registering student:', error);
        if (error.code === '23505') {  // Unique violation error code
            res.status(400).json({ error: 'Student already exists.' });
        } else {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});


app.post('/find-student', isAuthenticated, async (req, res) => {
    const { 'find-fname': firstName, 'find-lname': lastName } = req.body;

    try {
        const query = `
            SELECT * FROM student
            WHERE "F_Name" ILIKE $1 OR "L_Name" ILIKE $2
        `;
        const values = [`%${firstName}%`, `%${lastName}%`]; // Use ILIKE for case-insensitive search

        const result = await pool.query(query, values);

        if (result.rows.length > 0) {
            // If students are found, send the data back to the client
            res.json({ message: 'Students found', students: result.rows });
        } else {
            res.json({ message: 'No students found' });
        }
    } catch (error) {
        console.error('Error finding student:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// Route to fetch all students
app.get('/all-students', isAuthenticated, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM student');
        res.json(result.rows); // Send all students as JSON
    } catch (error) {
        console.error('Error fetching all students:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// Route to handle the form submission
app.post('/register-guardian', (req, res) => {
    const { g_f_name, g_mi, g_l_name, g_cell, g_email, g_staddress, g_city, g_state, g_zip, gender } = req.body;

    // Insert data into the guardian table
    const query = `
        INSERT INTO guardian (g_f_name, g_mi, g_l_name, g_cell, g_email, g_staddress, g_city, g_state, g_zip, gender)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *;
    `;

    pool.query(query, [g_f_name, g_mi, g_l_name, g_cell, g_email, g_staddress, g_city, g_state, g_zip, gender], (error, result) => {
        if (error) {
            console.error('Error inserting data:', error);
            res.status(500).send('Error registering guardian');
        } else {
            console.log('Guardian registered:', result.rows[0]);
            res.send('Guardian registered successfully!');
        }
    });
});


// Route to get all guardians
app.get('/all-guardians', (req, res) => {
    const query = 'SELECT * FROM guardian';

    pool.query(query, (error, result) => {
        if (error) {
            console.error('Error fetching guardians:', error);
            res.status(500).send('Error retrieving guardians');
        } else {
            res.json(result.rows);  // Send the guardians data as JSON
        }
    });
});


// API to get concatenated student names
app.get('/getStudentNames', async (req, res) => {
    try {
        const result = await pool.query('SELECT "St_ID", CONCAT("F_Name", \' \', "L_Name") AS full_name FROM public."student"');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching student names');
    }
});

// API to get concatenated guardian names
app.get('/getGuardianNames', async (req, res) => {
    try {
        const result = await pool.query('SELECT g_id, CONCAT(g_f_name, \' \', g_l_name) AS full_name FROM public."guardian"');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).send('Error fetching guardian names');
    }
});


app.post('/assignGuardian', async (req, res) => {
    const { st_id, g_id, relationship_type } = req.body;

    try {
        await pool.query(
            'INSERT INTO student_guardian (st_id, g_id, relationship_type) VALUES ($1, $2, $3)',
            [st_id, g_id, relationship_type]
        );
        res.status(200).send('Guardian assigned successfully');
    } catch (err) {
        console.error('Error assigning guardian:', err); // Log the error
        res.status(500).send('Error assigning guardian');
    }
});


app.get('/getStudentGuardianData', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                concat(s."F_Name", ' ', s."MI", ' ',s."L_Name") AS student_name,
                concat(g."g_f_name", ' ', g."g_mi", ' ', g."g_l_name") AS guardian_name,
                sg."relationship_type",
                g."g_cell",
                g.g_email
            FROM 
                student AS s
            JOIN 
                student_guardian AS sg ON s."St_ID" = sg."st_id"
            JOIN 
                guardian AS g ON sg."g_id" = g."g_id";
        `);
        
        console.log(result.rows); // Check what data is being returned
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching student-guardian data:', error);
        res.status(500).send('Server Error');
    }
});


// Get all subjects
app.get('/api/subjects', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM subject');
        res.json(result.rows); // Adjust according to your database structure
    } catch (error) {
        console.error('Error fetching subjects:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Add a new subject
app.post('/api/subjects', async (req, res) => {
    const { subject } = req.body;

    try {
        const query = 'INSERT INTO subject ("subject") VALUES ($1)';
        await pool.query(query, [subject]);
        res.status(201).json({ message: 'Subject added successfully!' });
    } catch (error) {
        console.error('Error adding subject:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// Fetch students
app.get('/getStudentNames', async (req, res) => {
    try {
        const students = await pool.query('SELECT St_ID, CONCAT(F_Name, " ", L_Name) AS full_name FROM student');
        res.json(students.rows);
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).send('Server Error');
    }
});

// Fetch levels
app.get('/getLevels', async (req, res) => {
    console.log('Fetching levels...');
    try {
        const levels = await pool.query('SELECT level_id, level_number FROM level');
        res.json(levels.rows);
    } catch (error) {
        console.error('Error fetching levels:', error);
        res.status(500).send('Server Error');
    }
});

// Function to get full name by student ID
async function getFullNameByStudentId(studentId) {
    const query = 'SELECT CONCAT("F_Name", \' \', "L_Name") AS full_name FROM student WHERE "St_ID" = $1';
    const { rows } = await pool.query(query, [studentId]);
    return rows[0] ? rows[0].full_name : ''; // Return the full name or an empty string if not found
}

// Endpoint to assign level to a student
app.post('/assignLevel', async (req, res) => {
    const { studentId, levelId } = req.body;
    console.log('Assigning level:', { studentId, levelId });

    // Fetch the full name
    const fullName = await getFullNameByStudentId(studentId);
    console.log('Full name fetched:', fullName);

    const insertQuery = 'INSERT INTO student_level (st_id, level_id, full_name) VALUES ($1, $2, $3) RETURNING *';

    try {
        const result = await pool.query(insertQuery, [studentId, levelId, fullName]);
        res.status(201).json(result.rows[0]); // Respond with the newly inserted record
    } catch (error) {
        console.error('Error inserting into student_level:', error);
        res.status(500).send('Error assigning level');
    }
});


// Endpoint to get assigned levels
app.get('/getAssignedLevels', async (req, res) => {
    try {
        const assignedLevels = await pool.query('SELECT st_id, level_id, full_name FROM student_level');
        res.json(assignedLevels.rows);
    } catch (error) {
        console.error('Error fetching assigned levels:', error);
        res.status(500).send('Server Error');
    }
});


app.post('/register-teacher', async (req, res) => {
    const { t_f_name, t_mi, t_l_name, t_email, t_phone, gender, t_staddress, t_city, t_state, t_zip } = req.body;
    console.log('Received teacher registration data:', req.body); // Log received data

    // Validate required fields
    if (!t_f_name || !t_l_name || !t_email) {
        return res.status(400).json({ success: false, message: 'Please fill out all required fields.' });
    }

    const query = `
        INSERT INTO teachers (t_f_name, t_mi, t_l_name, t_email, t_phone, gender, t_staddress, t_city, t_state, t_zip) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`;
    const values = [t_f_name, t_mi, t_l_name, t_email, t_phone, gender, t_staddress, t_city, t_state, t_zip];

    try {
        const result = await pool.query(query, values);
        console.log('New teacher registered:', result.rows[0]); // Log the newly registered teacher
        return res.json({ success: true, teacher: result.rows[0] });
    } catch (error) {
        console.error('Error executing query:', error);
        return res.status(500).json({ success: false, message: 'Error registering teacher.' });
    }
});


app.get('/all-teachers', async (req, res) => {
    const query = 'SELECT * FROM teachers'; // Query to select all teachers
    
    try {
        const result = await pool.query(query); // Execute the query
        res.json({ teachers: result.rows }); // Send the result as JSON
    } catch (error) {
        console.error('Error fetching teachers:', error);
        res.status(500).json({ message: 'Error fetching teachers' });
    }
});

// Logout route teacher
app.get('/teacher-logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.send('Error logging out');
        }
        res.clearCookie('username');  // Clear the username cookie
        res.redirect('/teachers/teachers.html');
    });
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.send('Error logging out');
        }
        res.clearCookie('username');  // Clear the username cookie
        res.redirect('/login');
    });
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
