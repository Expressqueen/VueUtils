let apiUrl;
switch(process.env.NODE_ENV){
    case "dev":
        apiUrl="http://39.97.165/api";
        break;
    case "prod":
        apiUrl="http://39.97.165/api";
        break;
    case "test":
        apiUrl="http://39.97.165/api";
        break
}
export {apiUrl}