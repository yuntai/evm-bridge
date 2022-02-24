import express from "express";
import {dumpRecords } from "./tasks/db";

var app = express();

app.listen(3000, () => {
   console.log("Server running on port 3000");
});

app.get("/records", async (req, res, next) => {
   const rows = await dumpRecords();
   res.json(rows);
});
