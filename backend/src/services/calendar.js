"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateIcsContent = void 0;
const ics = __importStar(require("ics"));
const generateIcsContent = (params) => {
    const { title, description, start, end, location, url, organizer, attendees } = params;
    // ics expects date as [year, month, date, hours, minutes]
    const startArray = [
        start.getUTCFullYear(),
        start.getUTCMonth() + 1, // months are 1-indexed in ics
        start.getUTCDate(),
        start.getUTCHours(),
        start.getUTCMinutes()
    ];
    const endArray = [
        end.getUTCFullYear(),
        end.getUTCMonth() + 1,
        end.getUTCDate(),
        end.getUTCHours(),
        end.getUTCMinutes()
    ];
    const event = {
        start: startArray,
        end: endArray,
        startInputType: 'utc',
        endInputType: 'utc',
        title,
        description,
        status: 'CONFIRMED',
        busyStatus: 'BUSY'
    };
    if (location)
        event.location = location;
    if (url)
        event.url = url;
    if (organizer)
        event.organizer = organizer;
    if (attendees)
        event.attendees = attendees;
    const { error, value } = ics.createEvent(event);
    if (error) {
        console.error('Failed to generate ICS file:', error);
        return null;
    }
    return value || null;
};
exports.generateIcsContent = generateIcsContent;
//# sourceMappingURL=calendar.js.map