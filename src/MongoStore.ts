import * as fs from 'fs';
import mongoose, {Connection } from "mongoose";
import {MongooseStore} from "./interfaces/mongooseStore";

export class MongoStore {
    get connection(): Connection | undefined {
        return this._connection;
    }

    set connection(value: Connection) {
        this._connection = value;
    }

    private _connection : Connection | undefined;

    constructor(config : MongooseStore) {
        this.connection = config.connection;
        if(this.connection)
            throw new Error('A valid Mongoose instance is required for MongoStore.');
    }

    async sessionExists(options : any) {
        if (this.connection === undefined || this.connection.db === undefined)
            throw new Error("db not found")

        let multiDeviceCollection = this.connection.db?.collection(`whatsapp-${options.session}.files`);
        let hasExistingSession = await multiDeviceCollection?.countDocuments();
        return !!hasExistingSession;   
    }
    
    async save(options : any) {
        if (this.connection === undefined || this.connection.db === undefined)
            throw new Error("db not found")

        const bucket = new mongoose.mongo.GridFSBucket(this.connection.db, {
            bucketName: `whatsapp-${options.session}`
        });

        await new Promise<void>((resolve, reject) => {
            fs.createReadStream(`${options.session}.zip`)
                .pipe(bucket.openUploadStream(`${options.session}.zip`))
                .on('error', (err) => reject(err))
                .on('close', () => {
                    resolve();
                });
        });
        options.bucket = bucket;
        await this.#deletePrevious(options);
    }

    async extract(options : any) : Promise<void> {
        if (this.connection === undefined || this.connection.db === undefined)
            throw new Error("db not found")

        const bucket = new mongoose.mongo.GridFSBucket(this.connection.db, {
            bucketName: `whatsapp-${options.session}`
        });
        return new Promise((resolve, reject) => {
            bucket.openDownloadStreamByName(`${options.session}.zip`)
                .pipe(fs.createWriteStream(options.path))
                .on('error', err => reject(err))
                .on('close', () => resolve());
        });
    }

    async delete(options : any) {

        if (this.connection === undefined || this.connection.db === undefined)
            throw new Error("db not found")

        const bucket = new mongoose.mongo.GridFSBucket(this.connection.db, {
            bucketName: `whatsapp-${options.session}`
        });

        const documents = await bucket.find({
            filename: `${options.session}.zip`
        }).toArray();

        documents.map(async doc => {
            return bucket.delete(doc._id);
        });   
    }

    async #deletePrevious(options : any) {
        const documents = await options.bucket.find({
            filename: `${options.session}.zip`
        }).toArray();
        if (documents.length > 1) {
            const oldSession = documents.reduce((a: { uploadDate: number; }, b: { uploadDate: number; }) => {
                return a.uploadDate < b.uploadDate ? a : b;
            });
            return options.bucket.delete(oldSession._id);   
        }
    }
}

export default MongoStore