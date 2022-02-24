fn=db.db
rm $fn
sqlite3 $fn <<EOF
CREATE TABLE records(
    id,
    fromchain, tochain,
    fromaddr, toaddr,
    amount, state
);
EOF

sqlite3 $fn .schema
echo "db junked and recreated";
