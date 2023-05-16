const express = require("express");
const app = express();
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
app.use(express.json());
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDbAndServer();
//App1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
        SELECT *
        FROM user
        WHERE username= '${username}';
    `;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordCorrect = await bcrypt.compare(
      `${password}`,
      dbUser.password
    );
    if (isPasswordCorrect) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "SECRET_KEY");
      response.status(200);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
const authenticateToken = async (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken = null;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
    await jwt.verify(jwtToken, "SECRET_KEY", (error, user) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = user.username;
        next();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};
//APP2
app.get("/states/", authenticateToken, async (request, response) => {
  const query = `
        SELECT state_id AS stateId, state_name As stateName, population
        FROM state;
    `;
  const dbResponse = await db.all(query);
  response.send(dbResponse);
});
//App3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const query = `
        SELECT state_id AS stateId, state_name As stateName, population
        FROM state
        WHERE state_id= '${stateId}'
    `;
  const dbResponse = await db.get(query);
  response.send(dbResponse);
});
//App4
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const query = `
    INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
    VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths});
  `;
  await db.run(query);
  response.send("District Successfully Added");
});
//App5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const query = `
        SELECT district_id AS districtId,district_name AS districtName, state_id AS stateId, cases,cured,active,deaths
        FROM district
        WHERE district_id= '${districtId}';
    `;
    const dbResponse = await db.get(query);
    response.send(dbResponse);
  }
);
//App6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const query = `
       DELETE FROM district
        WHERE district_id= '${districtId}';
    `;
    await db.run(query);
    response.send("District Removed");
  }
);
//App7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const query = `
      UPDATE district
      SET district_name= '${districtName}',state_id= ${stateId},cases= ${cases},cured= ${cured},active= ${active},deaths= ${deaths}
     WHERE district_id= '${districtId}';
    `;
    await db.run(query);
    response.send("District Details Updated");
  }
);
//App8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const query = `
        SELECT SUM(district.cases) AS totalCases, SUM(district.cured) AS totalCured, SUM(district.active) AS totalActive, SUM(district.deaths) AS totalDeaths
        FROM state INNER JOIN district ON state.state_id= district.state_id
        WHERE state.state_id= '${stateId}'
    `;
    const dbResponse = await db.get(query);
    response.send(dbResponse);
  }
);
module.exports = app;
