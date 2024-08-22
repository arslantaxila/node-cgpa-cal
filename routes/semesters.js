
const express = require("express");
const router = express.Router();
const pool = require('../config/connection');
var auth = require("../services/authentication");
const logger = require("../common/logger");
const { validatesemester, validateimportsemester } = require("../models/semester");
const fs = require("fs");
const multer = require("multer");
const csv = require("csv-parser");
const path = require("path");



router.get('/', auth.authenticateToken, async (req, res) => {
    const signedin_user = res.locals.id;
    try {
        const connection = await pool;
        const [rows, fields] = await connection.query('SELECT s.id, s.name, s.gpa,  count(c.id) as total_course,  sum(c.credit_hour) as credit_hour  FROM semester s join course c on (s.id = c.semester_id) where s.user_id = ?  group by s.id order by s.name asc', signedin_user);
        res.json(rows);
    } catch (error) {
        logger.error('Error fetching semester:', error);
        res.status(500).json({ error: 'Error fetching semester' });
    }
});

router.get('/course/:id', auth.authenticateToken, async (req, res) => {
    const semester_id = req.params.id;
    try {
        const connection = await pool;
        const [rows, fields] = await connection.query('SELECT id,name,code,gpa,marks,credit_hour FROM course where semester_id = ?', semester_id);
        res.json(rows);
    } catch (error) {
        logger.error('Error fetching semester courses:', error);
        res.status(500).json({ error: 'Error fetching semester courses' });
    }
});


router.post(
    "/create",
    auth.authenticateToken,
    async (req, res) => {
        const result = validatesemester(req.body);
        const signedin_user = res.locals.id;
        const r = req.body;
        let connection = await pool.getConnection();
        if (result.error) {
            logger.error(`Create semester error is: ${result.error.details[0].message}`);
            res.status(400).json({ message: result.error.details[0].message });
            return;
        } else {


            try {
                await connection.beginTransaction();
                query =
                    "INSERT INTO `semester` (`name`, `gpa`, `user_id`, `created_at`, `created_by`) VALUES (?, ?, ?, now(), ?)";

                // Execute the main query
                const [result] = await connection.query(query, [
                    r.semester,
                    r.gpa,
                    signedin_user,
                    signedin_user
                ]);

                // Get the ID of the newly inserted order
                const insertID = result.insertId;
                const courses = r.courses;

                innerQuery =
                    "INSERT INTO `course` (`semester_id`, `name`, `code`, `credit_hour`, `marks`, `gpa`, `created_at`, `created_by`) VALUES (?,?, ?, ?, ?, ?, now(), '1');"


                // Execute the inner queries for each variable
                await Promise.all(courses.map(async (element) => {
                    await connection.query(innerQuery, [
                        insertID,
                        element.name,
                        element.code,
                        element.credit_hour,
                        element.marks,
                        element.gpa,
                        signedin_user
                    ]);
                }));

                // Commit the transaction
                await connection.commit();

                // Send a success response
                logger.info("Semester added successfully");
                return res.status(200).json({ message: "Semester added successfully" });

            } catch (error) {
                // Rollback the transaction in case of an error
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    logger.error("Rollback error:", rollbackError);
                }

                if (error.code == "ER_DUP_ENTRY") {
                    logger.error("Create Semester error is:", error);
                    res.status(400).json({
                        message:
                            "Semester already exists. ",
                    });
                    return;
                }

                // Log the original error and send an error response
                logger.error("Create Semester error is:", error);
                return res.status(400).json({ message: error.message });

            }
        }
    }
);

// Set up multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/import/"); // Specify the upload directory
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    },
});

// Create the multer instance
const localupload = multer({ storage: storage });

async function calculateGPA(courses) {

    let totalCreditHours = 0;
    let totalWeightedGPA = 0;

    for (const course of courses) {
        totalCreditHours += Number(course.credit_hour);
        totalWeightedGPA += Number(course.credit_hour) * Number(course.gpa);
    }

    const overallGPA = totalWeightedGPA / totalCreditHours;
    return overallGPA;
}

router.get('/getDocument', auth.authenticateToken, async (req, res) => {
    const file = path.join(__dirname, "../uploads/format.csv");
    res.download(file, (err) => {
        if (err) {
            // console.error('Error downloading the file:', err);
            res.status(500).send('Error downloading the file');
        }
    });
})



router.post("/import", auth.authenticateToken, localupload.single("file"), async (req, res) => {
    const signedin_user = res.locals.id;

    if (req.file) {
        const uploadedFileName = req.file.filename;
        const csvFilePath = "uploads/import/" + uploadedFileName; // Replace with your CSV file path
        let Maindata = []; // Initialize an empty array to store data
        let SecondaryData = []; // Initialize an empty array to store data

        const processCSV = async () => {
            const stream = fs.createReadStream(csvFilePath).pipe(csv());

            for await (const row of stream) {
                Maindata.push(row);
            }

            // Sort the data by semester
            Maindata.sort((a, b) => {
                const semesterA = parseInt(a.semester.split(' ')[1]);
                const semesterB = parseInt(b.semester.split(' ')[1]);
                return semesterA - semesterB;
            });

            const result = validateimportsemester(Maindata);

            if (result.error) {
                logger.error(`Validation csv file error is: ${result.error.details[0].message}`);
                res.status(400).json({ message: "Invalid Data" });
                return;
            }

            try {
                const connection = await pool;
                const [rows] = await connection.query('SELECT * FROM grade');

                for (const element of Maindata) {
                    const grade = rows.find(grade => element.marks >= grade.min && element.marks <= grade.max);
                    if (grade) {
                        const newRow = {
                            semester: element.semester,
                            course: element.course,
                            code: element.code,
                            marks: element.marks,
                            credit_hour: element.credit_hour,
                            gpa: grade.point
                        };
                        SecondaryData.push(newRow);
                    }
                }

                const groupedData = Object.values(SecondaryData.reduce((acc, item) => {
                    if (!acc[item.semester]) {
                        acc[item.semester] = [];
                    }
                    acc[item.semester].push(item);
                    return acc;
                }, {}));

                for (const element of groupedData) {
                    let semester = element.length > 0 ? element[0].semester : null;
                    try {
                        const gpa = await calculateGPA(element);

                        const query =
                            "INSERT INTO `semester` (`name`, `gpa`, `user_id`, `created_at`, `created_by`) VALUES (?, ?, ?, now(), ?)";

                        const [result] = await connection.query(query, [
                            semester,
                            gpa,
                            signedin_user,
                            signedin_user
                        ]);

                        const insertID = result.insertId;

                        for (const innerelement of element) {
                            const innerQuery =
                                "INSERT INTO `course` (`semester_id`, `name`, `code`, `credit_hour`, `marks`, `gpa`, `created_at`, `created_by`) VALUES (?, ?, ?, ?, ?, ?, now(), ?)";

                            await connection.query(innerQuery, [
                                insertID,
                                innerelement.course,
                                innerelement.code,
                                innerelement.credit_hour,
                                innerelement.marks,
                                innerelement.gpa,
                                signedin_user
                            ]);
                        }
                    } catch (innerError) {
                        if (innerError.code === "ER_DUP_ENTRY") {
                            logger.error("Create Semester error is:", innerError);
                            res.status(400).json({ message: "Semester already exists, invalid data in file" });
                            return;
                        } else {
                            // console.error("Error processing CSV:", innerError);
                            res.status(500).json({ message: "Internal Server Error" });
                            return;
                        }
                    }
                }

                // console.log("CSV file successfully processed");
                res.status(200).json({ SecondaryData });

            } catch (error) {
                if (error.code === "ER_DUP_ENTRY") {
                    logger.error("Create Semester error is:", error);
                    res.status(400).json({ message: "Semester already exists, invalid data in file" });
                } else {
                    console.error("Error processing CSV:", error);
                    res.status(500).json({ message: "Internal Server Error" });
                }
            }
        };

        processCSV();
    } else {
        res.status(400).json({ message: "File not found" });
    }
});


router.put(
    "/:id",
    auth.authenticateToken,
    async (req, res) => {
        const result = validatesemester(req.body);
        const signedin_user = res.locals.id;
        const semester_id = req.params.id;
        const r = req.body;
        let connection = await pool.getConnection();
        if (result.error) {
            logger.error(`Update semester error is: ${result.error.details[0].message}`);
            res.status(400).json({ message: result.error.details[0].message });
            return;
        } else {

            try {
                await connection.beginTransaction();

                query =
                    "UPDATE `semester` SET `name` = ?, `gpa` = ?, `user_id` = ?, `updated_at` = now(), `updated_by` = ? WHERE (`id` = ?)";

                // Execute the main query
                const [result] = await connection.query(query, [
                    r.semester,
                    r.gpa,
                    signedin_user,
                    signedin_user,
                    semester_id
                ]);

                const courses = r.courses;

                deleteQuery =
                    "delete from `course` where semester_id = ?"

                await connection.query(deleteQuery, [semester_id]);

                innerQuery =
                    "INSERT INTO `course` (`semester_id`, `name`, `code`, `credit_hour`, `marks`, `gpa`, `created_at`, `created_by`) VALUES (?,?, ?, ?, ?, ?, now(), '1');"


                // Execute the inner queries for each variable
                await Promise.all(courses.map(async (element) => {
                    await connection.query(innerQuery, [
                        semester_id,
                        element.name,
                        element.code,
                        element.credit_hour,
                        element.marks,
                        element.gpa,
                        signedin_user
                    ]);
                }));

                // Commit the transaction
                await connection.commit();

                // Send a success response
                logger.info("Semester updatad successfully");
                return res.status(200).json({ message: "Semester updated successfully" });

            } catch (error) {
                // Rollback the transaction in case of an error
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    logger.error("Rollback error:", rollbackError);
                }

                if (error.code == "ER_DUP_ENTRY") {
                    logger.error("Update Semester error is:", error);
                    res.status(400).json({
                        message:
                            "Semester already exists. ",
                    });
                    return;
                }

                // Log the original error and send an error response
                logger.error("Update semester error is:", error);
                return res.status(400).json({ message: error.message });

            }
        }
    }
);






router.delete("/:id", auth.authenticateToken, async (req, res) => {
    const semester_id = req.params.id;
    let connection = await pool.getConnection();
    try {
        deleteQuery =
            "delete from `semester` where id = ?"
        const [deleteResult] = await connection.query(deleteQuery, [semester_id]);
        // Send a success response
        logger.info("Semester deleted successfully");
        return res.status(200).json({ message: "Semester delete successfully" });
    } catch (error) {
        // Log the original error and send an error response
        logger.error("delete Semester error is:", error);
        return res.status(400).json({ message: error.message });
    }
})


module.exports = router;
