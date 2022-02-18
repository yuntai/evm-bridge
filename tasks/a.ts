interface A {
    a: string,
    b: string
}

let a:A = { 'a': 'hello', 'b': 'hello' }
let k:keyof A;
for(k in a) {
    console.log("k: ", k);
    console.log(a[k]);
}
