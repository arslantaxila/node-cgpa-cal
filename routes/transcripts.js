const express = require("express");
const router = express.Router();
const pool = require('../config/connection');
var auth = require("../services/authentication");
const logger = require("../common/logger");
const { validatetranscript } = require("../models/transcript");



router.get('/grade', auth.authenticateToken, async (req, res) => {
    try {
        const connection = await pool;
        const [rows, fields] = await connection.query('SELECT * FROM grade');
        res.json(rows);
    } catch (error) {
        logger.error('Error fetching grade:', error);
        res.status(500).json({ error: 'Error fetching grade' });
    }
});


router.get('/dashboardcount/:cdate', auth.authenticateToken, async (req, res) => {
    const cdate = req.params.cdate;
    try {
        const connection = await pool;
        const [rows, fields] = await connection.query("SELECT (SELECT count(t.id) from transcript t where date(created_at) = ?) as today_request, (SELECT count(t.id) from transcript t where status = 'Pending') as pending_request, (SELECT count(t.id) from transcript t where status = 'Underprocess') as underprocess_request, (SELECT count(t.id) from transcript t where status = 'Ready to Collect') as readytocollect_request, (SELECT count(t.id) from transcript t where status = 'Complete') as complete_request", cdate);
        res.json(rows);
    } catch (error) {
        logger.error('Error fetching dashboardcount:', error);
        res.status(500).json({ error: 'Error fetching dashboardcount' });
    }
});

router.get('/mydashboardcount/:cdate', auth.authenticateToken, async (req, res) => {
    const cdate = req.params.cdate;
    const signedin_user = res.locals.id;
    try {
        const connection = await pool;
        const [rows, fields] = await connection.query("SELECT (SELECT count(t.id) from transcript t where date(created_at) = ? and t.user_id = ?) as today_request, (SELECT count(t.id) from transcript t where status = 'Pending' and t.user_id = ?) as pending_request, (SELECT count(t.id) from transcript t where status = 'Underprocess' and t.user_id = ?) as underprocess_request, (SELECT count(t.id) from transcript t where status = 'Ready to Collect' and t.user_id = ?) as readytocollect_request, (SELECT count(t.id) from transcript t where status = 'Complete' and t.user_id = ?) as complete_request",[ cdate, signedin_user, signedin_user, signedin_user, signedin_user, signedin_user]);
        res.json(rows);
    } catch (error) {
        logger.error('Error fetching mine dashboardcount:', error);
        res.status(500).json({ error: 'Error fetching mine dashboardcount' });
    }
});




router.get('/', auth.authenticateToken, async (req, res) => {
    const signedin_user = res.locals.id;
    try {
        const connection = await pool;
        const [rows, fields] = await connection.query('SELECT t.id,u.name, t.email, t.type, t.cnic, t.mobile, t.status, t.created_at FROM transcript t join user u on (u.id = t.user_id)');
        res.json(rows);
    } catch (error) {
        logger.error('Error fetching transcript:', error);
        res.status(500).json({ error: 'Error fetching transcript' });
    }
});


router.get('/mine', auth.authenticateToken, async (req, res) => {
    const signedin_user = res.locals.id;
    try {
        const connection = await pool;
        const [rows, fields] = await connection.query('SELECT t.id,u.name, t.email, t.type, t.cnic, t.mobile, t.status, t.created_at FROM transcript t join user u on (u.id = t.user_id) where u.id = ?', signedin_user);
        res.json(rows);
    } catch (error) {
        logger.error('Error fetching mine transcript:', error);
        res.status(500).json({ error: 'Error fetching mine transcript' });
    }
});

router.post(
    "/create",
    auth.authenticateToken,
    async (req, res) => {
        const result = validatetranscript(req.body);
        const signedin_user = res.locals.id;
        const r = req.body;
        var hash = "";
        const connection = await pool;

        if (result.error) {
            logger.error(`Create transcript error is: ${result.error.details[0].message}`);
            res.status(400).json({ message: result.error.details[0].message });
            return;
        } else {

            try {
                query =
                    "INSERT INTO `transcript` (`user_id`, `type`, `email`, `cnic`, `mobile`, `created_at`, `created_by`) VALUES (?, ?, ?, ?, ?, now(), ?);";
                const [result] = await connection.query(query, [
                    signedin_user,
                    r.type,
                    r.email,
                    r.cnic,
                    r.mobile,
                    signedin_user
                ])

                return res.status(200).json({ message: "Transcript request added successfully" });

            } catch (error) {

                logger.error("Create transcript error is:", error);
                res.status(400).json({ message: error.message });
                return;

            }
        }
    }
);


router.delete("/:id", auth.authenticateToken, async (req, res) => {
    const order_id = req.params.id;
    let connection = await pool.getConnection();

    try {
        deleteQuery =
            "delete from `transcript` where id = ?"
        const [deleteResult] = await connection.query(deleteQuery, [order_id]);
        // Send a success response
        logger.info("Transcript request deleted successfully");
        return res.status(200).json({ message: "Transcript request delete successfully" });
    } catch (error) {
        // Log the original error and send an error response
        logger.error("delete transcript error is:", error);
        return res.status(400).json({ message: error.message });
    }
})


router.put(
    "/:id",
    auth.authenticateToken,
    async (req, res) => {
        const signedin_user = res.locals.id;
        const transcript_id = req.params.id;
        const r = req.body;
        let connection = await pool.getConnection();
        try {
            query =
                "UPDATE `transcript` SET `status` = ?, `updated_at` = now(), `updated_by` = ? WHERE (`id` = ?)";

            const [result] = await connection.query(query, [
                r.status,
                signedin_user,
                transcript_id
            ]);
            logger.info("Transcript request Status updatad successfully");
            return res.status(200).json({ message: "Transcript request Status updated successfully" });

        } catch (error) {
            // Log the original error and send an error response
            logger.error("Create Transcript request Status error is:", error);
            return res.status(400).json({ message: error.message });

        }
    }

);


module.exports = router;