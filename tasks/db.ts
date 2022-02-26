// Importing SQLite3 to our project.
var sqlite3 = require("sqlite3").verbose();

export async function addRecord(
	id: string,
	fromchain: string, tochain: string,
	from: string, to: string, amount: number) {
    const db = new sqlite3.Database("db.db");
	return new Promise((resolve, reject) => {
		db.run("INSERT INTO records VALUES ($id, $fromchain, $tochain, $from, $to, $amount, $state)", {
			$id: id,
			$fromchain: fromchain,
			$tochain: tochain,
			$from: from,
			$to: to,
			$amount: amount,
			$state: 'LOCKED'
		}, function (err: any) {
			if (err) reject(err);
			else {
                db.close();
                resolve(true);
            }
		});
	});
}


export function updateState(id: string, state: string) {
    const db = new sqlite3.Database("db.db");
    var inputData = [state, id];
	return new Promise((resolve, reject) => {
        db.run("UPDATE records SET state=? WHERE id=?", inputData, function (err: any, rows: any) {
            if (err) reject(err);
            else {
                console.log(inputData, "ok");
                db.close();
                resolve(rows);
            }
        });
	});
}

export function dumpRecords() {
	// Add a task to the todo list.
    const db = new sqlite3.Database("db.db");
	return new Promise((resolve, reject) => {
		db.all("SELECT * FROM records",
			function (err: any, rows: any) {
				if (err) reject(err);
				else {
                    db.close();
                    resolve(rows);
                }
			});
	});
}
