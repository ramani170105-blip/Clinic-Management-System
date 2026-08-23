import * as ics from 'ics';

export interface CalendarEventParams {
  title: string;
  description: string;
  start: Date;
  end: Date;
  location?: string;
  url?: string;
  organizer?: { name: string; email: string };
  attendees?: Array<{ name: string; email: string }>;
}

export const generateIcsContent = (params: CalendarEventParams): string | null => {
  const { title, description, start, end, location, url, organizer, attendees } = params;
  
  // ics expects date as [year, month, date, hours, minutes]
  const startArray: ics.DateArray = [
    start.getUTCFullYear(),
    start.getUTCMonth() + 1, // months are 1-indexed in ics
    start.getUTCDate(),
    start.getUTCHours(),
    start.getUTCMinutes()
  ];
  
  const endArray: ics.DateArray = [
    end.getUTCFullYear(),
    end.getUTCMonth() + 1,
    end.getUTCDate(),
    end.getUTCHours(),
    end.getUTCMinutes()
  ];

  const event: any = {
    start: startArray,
    end: endArray,
    startInputType: 'utc',
    endInputType: 'utc',
    title,
    description,
    status: 'CONFIRMED',
    busyStatus: 'BUSY'
  };

  if (location) event.location = location;
  if (url) event.url = url;
  if (organizer) event.organizer = organizer;
  if (attendees) event.attendees = attendees;

  const { error, value } = ics.createEvent(event as ics.EventAttributes);
  
  if (error) {
    console.error('Failed to generate ICS file:', error);
    return null;
  }
  
  return value || null;
};
