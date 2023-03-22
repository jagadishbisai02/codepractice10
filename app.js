const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

//user login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
  SELECT 
    * 
  FROM 
    user 
  WHERE 
    username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    // user doesn't exists
    response.status(400);
    response.send("Invalid user");
  } else {
    //compare password and send response to user
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      // after passwords are matched
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "SCRETE");
      response.send({ jwtToken });
    } else {
      // if passwords are not matched
      response.status(400);
      response.send("Invalid password");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SCRETE", async (error, user) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.get("/states/", authenticateToken, async (request, response) => {
  const getCovid19Query = `SELECT * FROM state ORDER BY state_id;`;
  const covidArray = await db.all(getCovid19Query);
  response.send(covidArray);
});

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStatesQuery = `SELECT * FROM state WHERE state_id = ${stateId};`;
  const covidState = await db.get(getStatesQuery);
  response.send(covidState);
});

app.post("/districts/", authenticateToken, async (request, response) => {
  const {
    district_name,
    state_id,
    cases,
    cured,
    active,
    deaths,
  } = request.body;
  const createQuery = `INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
  VALUES(
      '${district_name}',
      '${state_id}',
      '${cases}',
      '${cured}',
      '${active}',
      '${deaths}'
  )`;
  await db.run(createQuery);
  response.send("District Successfully Added");
});
