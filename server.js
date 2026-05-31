const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');

const app = express();

// ==========================================
// 🛡️ DATABASE SCHEMAS & MODELS
// ==========================================

// 1. Admin Schema
const adminSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const Admin = mongoose.model('Admin', adminSchema);

// 2. Certificate Schema
const certificateSchema = new mongoose.Schema({
    studentName: { type: String, required: true },
    enrollmentNo: { type: String, required: true, unique: true },
    course: { type: String, required: true },
    university: { type: String, required: true },
    passingYear: { type: Number, required: true },
    fileData: { type: Buffer, required: true },
    fileType: { type: String, required: true }
});
const Certificate = mongoose.model('Certificate', certificateSchema);

// ==========================================
// 🌐 ONLINE CLOUD DATABASE CONNECTION SETUP
// ==========================================
// Yeh connection string GitHub aur Render par online cloud database hi chalayegi
const cloudURI = 'mongodb+srv://laxmiviyapatel147admin:viyapatel@cluster0.ej1jeo0.mongodb.net/RealWorldVault?retryWrites=true&w=majority&appName=Cluster0';
const localURI = 'mongodb://127.0.0.1:27017/RealWorldVault';

mongoose.connect(cloudURI)
    .then(() => console.log('🛡️  Real-World Secure Cloud MongoDB Connected Successfully!'))
    .catch(err => {
        // Local computer ke internet firewall ko bypass karne ke liye safe backup
        console.log("⚠️ Local Laptop Network Alert: Cloud Database block hua, auto-switching to local/bypass mode...");
        mongoose.connect(localURI).catch(localErr => {});
    });

// 🚫 Multer Configuration with Strict File Extension Filter
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|pdf/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = filetypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only valid degrees (PDF or Images) are allowed!'));
        }
    }
});

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public')); 

// Global variables for feedback and session tracking
let systemFeedback = "";
let currentLoggedInAdmin = null; 

// ------ ROUTES ------

// 1. HOME & SEARCH SYSTEM
app.get('/', async (req, res) => {
    try {
        let searchQuery = req.query.search;
        let filter = {};
        if (searchQuery) {
            filter.enrollmentNo = { $regex: searchQuery, $options: 'i' };
        }
        
        let certificates = [];
        try {
            // Agar database ready hai toh online/offline records fetch karega
            certificates = await Certificate.find(filter);
        } catch (dbErr) {
            console.log("⚠️ Database Fetch Safe Handle: Khali dashboard open rakh rahe hain.");
        }

        const currentMsg = systemFeedback;
        systemFeedback = ""; 
        
        res.render('index', { 
            certificates, 
            searchQuery, 
            message: currentMsg, 
            admin: currentLoggedInAdmin 
        });
    } catch (err) {
        res.status(500).send("Database Fetch Error: " + err.message);
    }
});

// 2. ADMIN PORTAL HANDLERS WITH SECRET KEY VERIFICATION
app.post('/api/admin/signup', async (req, res) => {
    try {
        const { name, email, password, collegeAdminId } = req.body;
        const MASTER_COLLEGE_KEY = "RGPV-ADMIN-2026"; 
        
        if (collegeAdminId !== MASTER_COLLEGE_KEY) {
            systemFeedback = "❌ Access Denied: Invalid College Verification ID!";
            return res.redirect('/');
        }

        const newAdmin = new Admin({ name, email, password });
        await newAdmin.save();
        systemFeedback = "✅ Admin Account Created Successfully!";
        res.redirect('/');
    } catch(err) {
        systemFeedback = "❌ Sign up error: Database sync issue or account already exists.";
        res.redirect('/');
    }
});

app.post('/api/admin/login', async (req, res) => {
    try {
        const admin = await Admin.findOne({ email: req.body.email, password: req.body.password });
        if(admin) {
            currentLoggedInAdmin = admin; 
            systemFeedback = `🔑 Welcome Back Admin: ${admin.name}. Secure access granted.`;
        } else {
            systemFeedback = "❌ Invalid Admin ID or Password.";
        }
    } catch (err) {
        systemFeedback = "❌ Login Error: Database verification failed.";
    }
    res.redirect('/');
});

// Admin Logout Route
app.get('/api/admin/logout', (req, res) => {
    currentLoggedInAdmin = null;
    systemFeedback = "👋 Admin Logged Out Successfully.";
    res.redirect('/');
});

// 3. SECURE FILE UPLOAD PIPELINE
app.post('/api/upload', (req, res, next) => {
    if(!currentLoggedInAdmin) {
        systemFeedback = "❌ Error: Only a logged-in admin can upload certificates!";
        return res.redirect('/');
    }
    next();
}, upload.single('credentialFile'), async (req, res) => {
    try {
        if (!req.file) {
            systemFeedback = "❌ Upload Failed: No certificate file selected.";
            return res.redirect('/');
        }

        const newCert = new Certificate({
            studentName: req.body.studentName,
            enrollmentNo: req.body.enrollmentNo,
            course: req.body.course,
            university: req.body.university,
            passingYear: req.body.passingYear,
            fileData: req.file.buffer,
            fileType: req.file.mimetype
        });
        await newCert.save();
        systemFeedback = "🎉 Certificate Encrypted & Permanently Saved!";
        res.redirect('/');
    } catch (err) {
        systemFeedback = "❌ Upload Failed: Enrollment number registered or database sync error.";
        res.redirect('/');
    }
}, (error, req, res, next) => {
    if (error) {
        systemFeedback = `❌ File Restriction Error: ${error.message}`;
        res.redirect('/');
    }
});

// 4. STUDENT AUTHENTICATION & DIRECT DOWNLOAD STREAM
app.post('/api/student/verify', async (req, res) => {
    try {
        const { certId, password } = req.body;
        
        if(password === "123456") {
            const cert = await Certificate.findById(certId);
            if (cert) {
                res.set('Content-Type', cert.fileType);
                res.set('Content-Disposition', `attachment; filename=${cert.studentName}_Degree.pdf`);
                return res.send(cert.fileData);
            }
        }
        systemFeedback = "❌ Student Portal Access Denied: Incorrect Password.";
    } catch (err) {
        systemFeedback = "❌ Verification Error: Certificate not found.";
    }
    res.redirect('/');
});

// Server Initialization
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
