import { ipcMain, ipcRenderer } from "electron";
import { Serializer, Message, Response, ClientRequest, ServerSideTransport, PersistentTransport } from "multi-rpc-common";

/**
 * A transport that uses Electron IPC.
 */
export default class ElectronTransport extends PersistentTransport implements ServerSideTransport {
    public connections: Map<any, any> = new Map();
    public connection: any = null;
    public connected = false;
    public reconnectDelay: any = null;
    
    /**
     * Is true when the transport is being used in the main process. 
     */
    public static get isServer() { return process && process.type === 'renderer'; }

    /**
     * 
     * @param serializer - Serializer for messages.
     * @param channelName - Channel name 
     */
    constructor(serializer: Serializer, public channelName: string) {
        super(serializer, false);
    }

    /**
     * Sends a message to the server, connecting to the server if a connection has not been made.
     * @param message - Message to send.
     * @async
     */
    public async send(message: Message): Promise<void> {
        ipcRenderer.send(this.channelName, this.serializer.serialize(message));
    }

    public async sendConnection() {

    }

    public async sendTo(id: any, message: Message) {
        return
        const webContents = this.connections.get(id);
        webContents.send(this.serializer.serialize(message));
        
    }

    protected renderReceiveBound = this.renderReceive.bind(this); 

    protected async renderReceive(event: any, arg: any) {
        this.receive(arg);
    }

    protected mainReceiveBound = this.mainReceive.bind(this); 

    protected async mainReceive(event: any, arg: any) {
        const sender = event.sender;
        const { id } = sender;

        if (!this.connections.has(id)) {
            this.connections.set(id, sender);
        }  

        const clientRequest = new ClientRequest(id, (response: Response) => {
            sender.send(this.serializer.serialize(response));
        });

        this.receive(arg, clientRequest)
    }

    public async connect(): Promise<any> {
        ipcRenderer.on(this.channelName, this.renderReceiveBound);
        this.emit("connect");
        this.connected = true;
    }

    public async listen(): Promise<void> {
        ipcMain.on(this.channelName, this.mainReceiveBound);
    }

    public async close(): Promise<void> {
        if (ElectronTransport.isServer) {
            ipcMain.removeListener(this.channelName, this.mainReceiveBound);
        } else {
            ipcMain.removeListener(this.channelName, this.renderReceiveBound);
            this.emit("disconnect");
            this.connected = false;
        }
    }
}