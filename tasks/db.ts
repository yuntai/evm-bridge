// Importing SQLite3 to our project.
var sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("db.db");

export async function addRecord(
	id: string,
	fromchain: string, tochain: string,
	from: string, to: string, amount: number) {
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
			else resolve(true);
		});
	});
}


export function updateState(id: string, state: string) {
	return new Promise((resolve, reject) => {
		db.run("UPDATE records SET state='$state' WHERE id='$id'"), {
			$id: id,
			$state: state
		}, function (err: any) {
			if (err) reject(err);
			else {
				db.run('commit');
				resolve(true);
			}
		};
	});
}

export function dumpRecords() {
	// Add a task to the todo list.
	return new Promise((resolve, reject) => {
		db.all("SELECT * FROM records",
			function (err: any, rows: any) {
				if (err) reject(err);
				else resolve(rows);
			});
	});
}
