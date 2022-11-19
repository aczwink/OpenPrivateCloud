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
import nodemailer from "nodemailer";
import { Injectable } from "acts-util-node";

interface EMailData
{
    from: string;
    to: string[];
    subject: string;
    text: string;
}

export interface MailerSettings
{
    host: string;
    port: number;
    userName: string;
    password: string;
}

@Injectable
export class EMailService
{
    //Public methods
    public async SendMail(mailData: EMailData, mailerSettings: MailerSettings)
    {
        const transporter = nodemailer.createTransport({
            host: mailerSettings.host,
            port: mailerSettings.port,
            auth: {
                user: mailerSettings.userName,
                pass: mailerSettings.password,
            }
        });

        const response = await transporter.sendMail(mailData);
    }
}