import {Connection, Mongoose} from "mongoose";


export interface MongooseStore {
    connection: Connection
}