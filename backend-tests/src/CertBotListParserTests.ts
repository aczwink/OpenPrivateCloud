/**
 * OpenPrivateCloud
 * Copyright (C) 2019-2022 Amir Czwink (amir130@hotmail.de)
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * */

import { Expect, It } from "acts-util-test";
import { CertBotListParser } from "openprivatecloud-backend/dist/src/resource-providers/web-services/CertBotListParser";

It("CertBotListParser Test", () => {
    const input = `
    Saving debug log to /var/log/letsencrypt/letsencrypt.log

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
Found the following certs:
  Certificate Name: test-cert
    Serial Number: 42e828677b2c16c675d69d3e62d89b602ed
    Key Type: RSA
    Domains: test-cert.com
    Expiry Date: 2023-02-18 21:12:15+00:00 (VALID: 89 days)
    Certificate Path: /etc/letsencrypt/live/test-cert/fullchain.pem
    Private Key Path: /etc/letsencrypt/live/test-cert/privkey.pem
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
`;
    const parser = new CertBotListParser();
    const certs = parser.Parse(input);

    Expect(certs.length).ToBe(1);
    const cert = certs[0];

    Expect(cert.name).ToBe("test-cert");
    Expect(cert.certificatePath).ToBe("/etc/letsencrypt/live/test-cert/fullchain.pem");
    Expect(cert.privateKeyPath).ToBe("/etc/letsencrypt/live/test-cert/privkey.pem");
    Expect(cert.expiryDate).Equals(new Date(Date.UTC(2023, 2 - 1, 18, 21, 12, 15, 0)));
});