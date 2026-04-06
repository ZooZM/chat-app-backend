import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { INestApplicationContext } from '@nestjs/common';
export declare class RedisIoAdapter extends IoAdapter {
    private adapterConstructor;
    constructor(app: INestApplicationContext);
    createIOServer(port: number, options?: ServerOptions): any;
}
