#!/bin/sh
FORMAT='window.process = { env: {OPC_BACKEND_URL:"%s",OPC_CLIENT_ID:"%s",OPC_FRONTEND_BASEURL:"%s",OPC_OIDP_ENDPOINT:"%s"} };\n'
printf "$FORMAT" "$OPC_BACKEND_URL" "$OPC_CLIENT_ID" "$OPC_FRONTEND_BASEURL" "$OPC_OIDP_ENDPOINT" > /var/www/html/env.js