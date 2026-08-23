export interface CalendarEventParams {
    title: string;
    description: string;
    start: Date;
    end: Date;
    location?: string;
    url?: string;
    organizer?: {
        name: string;
        email: string;
    };
    attendees?: Array<{
        name: string;
        email: string;
    }>;
}
export declare const generateIcsContent: (params: CalendarEventParams) => string | null;
//# sourceMappingURL=calendar.d.ts.map