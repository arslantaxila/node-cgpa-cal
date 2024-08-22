const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require('../config/connection');
const { validateuser } = require("../models/user");
var auth = require("../services/authentication");
var { checkSuperAdmin } = require("../services/role");
const logger = require("../common/logger");
const path = require("path");
const fs = require("fs");




router.get('/percentage', async (req, res) => {
    try {
        const connection = await pool;
        const [rows, fields] = await connection.query('SELECT * FROM configuration where name = "percentage" limit 1');
        res.json(rows);
    } catch (error) {
        logger.error('Error fetching percentage:', error);
        res.status(500).json({ error: 'Error fetching percentage' });
    }
});


router.get('/', auth.authenticateToken, checkSuperAdmin, async (req, res) => {
    const signedin_user = res.locals.id;
    try {
        const connection = await pool;
        const [rows, fields] = await connection.query('SELECT u.id, u.name, u.email, u.enrollment, u.password, r.name as role, r.id as role_id FROM user u join role r on (u.role = r.id) where u.id <> ? and u.id <> 1', signedin_user);
        res.json(rows);
    } catch (error) {
        logger.error('Error fetching users:', error);
        res.status(500).json({ error: 'Error fetching users' });
    }
});


router.post("/adminlogin", async (req, res) => {
    const { email, password } = req.body;
    const user_email = req.body.email;
    const connection = await pool;

    try {
        query =
            "SELECT id,name,email,password,role FROM user where email = ?";
        const [rows] = await connection.query(query, [email])

        if (rows.length === 0) {
            logger.info(
                `Login failed: Incorrect Email or Password- ${email} - ${new Date()}`
            );
            return res.status(401).json({ message: "Incorrect Email or Password" });
        }

        const user = rows[0];

        if (user.role == 3) {
            return res
                .status(401)
                .json({ message: "Please login through student portal." });
        }

        if (user.password) {

            bcrypt.compare(password, user.password, async (bErr, bResult) => {
                if (bErr) {
                    logger.error(`- ${user_email}  - ${new Date()}-Login error:`, bErr);
                    return res.status(500).json({ message: "Internal server error" });
                }

                if (bResult) {

                    const {
                        id,
                        name,
                        email,
                        role,
                    } = user;

                    query =
                        "SELECT r.display_name, r.name, rrp.read, rrp.create, rrp.update, rrp.delete FROM role_right_permission rrp join `right` r on (r.id = rrp.right_id) where rrp.role_id = ? and r.sub_heading = 0";

                    const [rows] = await connection.query(query, [role])

                    const rights = rows;

                    const response = {
                        id,
                        name,
                        email,
                        role,
                        rights
                    };

                    const accessToken = jwt.sign(
                        response,
                        process.env.ACCESS_TOKEN,
                        {
                            expiresIn: "8h",
                        }
                    );

                    logger.info(
                        `Login successful: Employee ID - ${id} - ${new Date()}`
                    );

                    const photoName = "user.png"

                    return res.status(200).json({
                        token: accessToken,
                        basicData: response,
                        photoName: photoName
                    });

                }
                else {
                    logger.info(
                        `Login failed: Incorrect Email or Password- ${email} - ${new Date()}`
                    );
                    return res
                        .status(401)
                        .json({ message: "Incorrect Email or Password" });
                }


            });

        } else {
            logger.error(`Login error: Password not found-${email} - ${new Date()}`);
            return res
                .status(400)
                .json({ message: "Something went wrong. Please try again later" });
        }

    } catch (error) {
        logger.error(`- ${email} - ${new Date()}-Login error:`, error);
        return res.status(500).json({ message: "Internal Server Error" });
    }

});

router.post("/login", async (req, res) => {
    const { enrollment, password } = req.body;
    // const user_email = req.body.enrollment;
    const connection = await pool;
    // console.log(enrollment);

    try {
        query =
            "SELECT id,name,email,password,role,enrollment  FROM user where enrollment = ?";
        const [rows] = await connection.query(query, [enrollment])

        if (rows.length === 0) {
            logger.info(
                `Login failed: Incorrect Email or Password- ${enrollment} - ${new Date()}`
            );
            return res.status(401).json({ message: "Incorrect Enrollment ID or Password" });
        }

        const user = rows[0];

        if (user.role == 2 && user.role == 1) {
            return res
                .status(401)
                .json({ message: "Please login through admin portal." });
        }

        if (user.password) {

            bcrypt.compare(password, user.password, async (bErr, bResult) => {
                if (bErr) {
                    logger.error(`- ${enrollment}  - ${new Date()}-Login error:`, bErr);
                    return res.status(500).json({ message: "Internal server error" });
                }

                if (bResult) {

                    const {
                        id,
                        name,
                        email,
                        role,
                    } = user;

                    query =
                        "SELECT r.display_name, r.name, rrp.read, rrp.create, rrp.update, rrp.delete FROM role_right_permission rrp join `right` r on (r.id = rrp.right_id) where rrp.role_id = ? and r.sub_heading = 0";

                    const [rows] = await connection.query(query, [role])

                    const rights = rows;

                    const response = {
                        id,
                        name,
                        email,
                        enrollment,
                        role,
                        rights
                    };

                    const accessToken = jwt.sign(
                        response,
                        process.env.ACCESS_TOKEN,
                        {
                            expiresIn: "8h",
                        }
                    );

                    logger.info(
                        `Login successful: Employee ID - ${id} - ${new Date()}`
                    );

                    const photoName = "user.png"

                    return res.status(200).json({
                        token: accessToken,
                        basicData: response,
                        photoName: photoName
                    });

                }
                else {
                    logger.info(
                        `Login failed: Incorrect Email or Password- ${enrollment} - ${new Date()}`
                    );
                    return res
                        .status(401)
                        .json({ message: "Incorrect Email or Password" });
                }


            });

        } else {
            logger.error(`Login error: Password not found-${email} - ${new Date()}`);
            return res
                .status(400)
                .json({ message: "Something went wrong. Please try again later" });
        }

    } catch (error) {
        logger.error(`- ${email} - ${new Date()}-Login error:`, error);
        return res.status(500).json({ message: "Internal Server Error" });
    }

});

router.get("/images/:imageName", auth.authenticateToken, async (req, res) => {
    const imageName = req.params.imageName;
    viewImage(imageName, (result) => {
        if (result.error) {
            res.status(404).json({ message: result.error });
        } else {
            res.writeHead(200, { "Content-Type": result.contentType });
            res.end(result.data);
        }
    });
});

async function viewImage(imageName, callback) {
    const imagePath = path.join(__dirname, "../uploads", imageName); // Path to your images directory
    fs.readFile(imagePath, (err, data) => {
        if (err) {
            logger.error("Get Profile Picture", err);
            callback({ status: "404", error: "Image not found" });
            // res.status(404).json({ message: "Image not found" });
        } else {
            const extension = path.extname(imageName).toLowerCase();
            let contentType = "image/jpeg"; // Default content type

            if (extension === ".png") {
                contentType = "image/png";
            } else if (extension === ".jpg" || extension === ".jpeg") {
                contentType = "image/jpeg";
            }
            callback({ status: "200", data: data, contentType: contentType });
            // res.writeHead(200, { "Content-Type": contentType });
            // res.end(data);
        }
    });
}


router.post(
    "/create/student",
    async (req, res) => {
        const result = validateuser(req.body);
        const r = req.body;
        var hash = "";
        const connection = await pool;

        if (result.error) {
            logger.error(`Create student error is: ${result.error.details[0].message}`);
            res.status(400).json({ message: result.error.details[0].message });
            return;
        } else {
            hash = await bcrypt.hash(r.password, 10);

            try {
                query =
                    "INSERT INTO `user` (`name`, `email`, `enrollment`, `cnic`, `password`, `role`, `created_at`) VALUES (?, ?, ?,?, ?, 3, now())";
                const [result] = await connection.query(query, [
                    r.name,
                    r.email,
                    r.enrollment,
                    r.cnic,
                    hash
                ])

                return res.status(200).json({ message: "student profile added successfully" });

            } catch (error) {
                if (error.code == "ER_DUP_ENTRY") {
                    logger.error("Create student error is:", error);
                    res.status(400).json({
                        message:
                            "Email & Enrollment ID must be a Unique",
                    });
                    return;
                } else {
                    logger.error("Create student error is:", error);
                    res.status(400).json({ message: error.message });
                    return;
                }
            }
        }
    }
);

router.post(
    "/create",
    auth.authenticateToken,
    checkSuperAdmin,
    async (req, res) => {
        const result = validateuser(req.body);
        const signedin_user = res.locals.id;
        const r = req.body;
        var hash = "";
        const connection = await pool;

        if (result.error) {
            logger.error(`Create user error is: ${result.error.details[0].message}`);
            res.status(400).json({ message: result.error.details[0].message });
            return;
        } else {
            if (r.password) {
                hash = await bcrypt.hash(r.password, 10);
            } else {
                const password = "user@12345";
                hash = await bcrypt.hash(password, 10);
            }

            let e
            if (r.enrollment) {
                e = r.enrollment
            } else {
                e = null;
            }

            try {
                query =
                    "INSERT INTO `user` (`name`, `email`, `enrollment`, `password`, `role`, `created_at`, `created_by`) VALUES (?, ?, ?, ?, ?, now(), ?)";
                const [result] = await connection.query(query, [
                    r.name,
                    r.email,
                    e,
                    hash,
                    r.role,
                    signedin_user
                ])

                return res.status(200).json({ message: "User profile added successfully" });

            } catch (error) {
                if (error.code == "ER_DUP_ENTRY") {
                    logger.error("Create user error is:", error);
                    res.status(400).json({
                        message:
                            "Email & Enrollment must be a Unique",
                    });
                    return;
                } else {
                    logger.error("Create user error is:", error);
                    res.status(400).json({ message: error.message });
                    return;
                }
            }
        }
    }
);



router.put(
    "/:id",
    auth.authenticateToken,
    checkSuperAdmin,
    async (req, res) => {
        const result = validateuser(req.body);
        const signedin_user = res.locals.id;
        const user_id = req.params.id;
        const r = req.body;
        var hash = "";
        const connection = await pool;

        if (result.error) {
            logger.error(`Update user error is: ${result.error.details[0].message}`);
            res.status(400).json({ message: result.error.details[0].message });
            return;
        } else {
            let e
            if (r.enrollment) {
                e = r.enrollment
            } else {
                e = null;
            }

            // console.log(e)

            if (r.password) {
                hash = await bcrypt.hash(r.password, 10);
                try {
                    query =
                        "UPDATE `user` SET `name` = ?, `email` = ?, `role` = ?, `enrollment` = ?, `password` = ?, `updated_at` = now(), `updated_by` = ? WHERE (`id` = ?)";
                    const [result] = await connection.query(query, [
                        r.name,
                        r.email,
                        r.role,
                        e,
                        hash,
                        signedin_user,
                        user_id
                    ])
                    logger.info("User profile updated successfully with password");
                    return res.status(200).json({ message: "User profile updated successfully" });

                } catch (error) {
                    if (error.code == "ER_DUP_ENTRY") {
                        logger.error("Update user error is:", error);
                        res.status(400).json({
                            message:
                                "Email & Enrollment ID  must be a Unique",
                        });
                        return;
                    } else {
                        logger.error("Update user error is:", error);
                        res.status(400).json({ message: error.message });
                        return;
                    }
                }
            } else {
                try {
                    query =
                        "UPDATE `user` SET `name` = ?, `email` = ?, `role` = ?, `enrollment` = ?, `updated_at` = now(), `updated_by` = ? WHERE (`id` = ?)";
                    const [result] = await connection.query(query, [
                        r.name,
                        r.email,
                        r.role,
                        e,
                        signedin_user,
                        user_id
                    ])
                    logger.info("User profile updated successfully without password");
                    return res.status(200).json({ message: "User profile updated successfully" });

                } catch (error) {
                    if (error.code == "ER_DUP_ENTRY") {
                        logger.error("Update user error is:", error);
                        res.status(400).json({
                            message:
                                "Email & Enrollment ID must be a Unique",
                        });
                        return;
                    } else {
                        logger.error("Update user error is:", error);
                        res.status(400).json({ message: error.message });
                        return;
                    }
                }
            }


        }
    }
);


module.exports = router;