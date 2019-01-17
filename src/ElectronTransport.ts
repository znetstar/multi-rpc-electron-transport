import { Serializer, Message, Response, ClientRequest, ServerSideTransport, PersistentTransport } from "multi-rpc-common";

/**
 * A transport that uses Electron IPC for communication.
 */
export default class ElectronTransport extends PersistentTransport implements ServerSideTransport {
    public connections: Map<any, any> = new Map();
    public connection: any = null;
    public connected = false;
    public reconnectDelay: any = null;
    
    /**
     * Is true when the transport is being used in the main process. 
     */
    public static get isServer() { return process && (<any>process).type === 'renderer'; }

    /**
     * EventEmitter for the main process.
     */
    private get ipcMain() { return this.electron.ipcMain; }

    /**
     * EventEmitter for the renderer process.
     */
    private get ipcRenderer() { return this.electron.ipcRenderer; }

    /**
     * 
     * @param serializer - Serializer for messages.
     * @param channelName - Channel name.
     * @param electron - Root electron object (e.g. `require("electron")`).
     */
    constructor(serializer: Serializer, public channelName: string, private electron: any) {
        super(serializer, false);
    }

    /**
     * Sends a message to the server, connecting to the server if a connection has not been made.
     * @param message - Message to send.
     * @async
     */
    public async send(message: Message): Promise<void> {
        this.ipcRenderer.send(this.channelName, this.serializer.serialize(message));
    }

    /**
     * @ignore
     */
    public async sendConnection(connection: any, message: Message) { 
        connection.send(this.channelName, this.serializer.serialize(message));
    }

    /**
     * Sends a message to a renderer.
     * @param id - ID of the WebContents to send to.
     * @param message - Message to send.
     */
    public async sendTo(id: any, message: Message) {
        const webContents = this.connections.get(id);
        webContents.send(this.channelName, this.serializer.serialize(message));
    }

    /**
     * @ignore
     */
    protected renderReceiveBound = this.renderReceive.bind(this); 

    /**
     * Processes incoming messages for the renderer.
     * @param event - Event details.
     * @param arg - Incoming message.
     */
    protected async renderReceive(event: any, arg: any) {
        this.receive(arg);
    }

    protected mainReceiveBound = this.mainReceive.bind(this); 

    /**
     * Processes incoming messages for the main process.
     * @param event - Event details.
     * @param arg - Incoming message.
     */
    protected async mainReceive(event: any, arg: any) {
        const sender = event.sender;
        const { id } = sender;

        if (!this.connections.has(id)) {
            this.connections.set(id, sender);
        }  

        const clientRequest = new ClientRequest(id, (response: Response) => {
            sender.send(this.channelName, this.serializer.serialize(response));
        });

        this.receive(arg, clientRequest)
    }

    /**
     * Begins listtening for messages from the main process.
     */
    public async connect(): Promise<any> {
        this.ipcRenderer.on(this.channelName, this.renderReceiveBound);
        this.emit("connect");
        this.connected = true;
    }

    /**
     * Begins listtening for messages from renderers.
     */
    public async listen(): Promise<void> {
        this.ipcMain.on(this.channelName, this.mainReceiveBound);
    }

    /**
     * Stops listening for incoming messages.
     */
    public async close(): Promise<void> {
        if (ElectronTransport.isServer) {
            this.ipcMain.removeListener(this.channelName, this.mainReceiveBound);
        } else {
            this.ipcMain.removeListener(this.channelName, this.renderReceiveBound);
            this.emit("disconnect");
            this.connected = false;
        }
    }
}