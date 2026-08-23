export interface EmailOptions {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    attachments?: Array<{
        filename: string;
        content: string | Buffer;
        contentType?: string;
    }>;
}
export declare const sendEmail: (options: EmailOptions) => Promise<any>;
//# sourceMappingURL=email.d.ts.map