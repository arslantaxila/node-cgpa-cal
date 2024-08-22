require("dotenv").config();

function checkSuperAdmin(req, res, next) {
    if (res.locals.role != process.env.SUPER_ADMIN) res.sendStatus(401);
    else next();
}

module.exports = { checkSuperAdmin };
