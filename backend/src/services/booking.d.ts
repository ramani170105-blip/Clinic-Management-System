export declare const holdSlot: (doctorId: string, patientId: string, startTime: Date, durationMins: number) => Promise<boolean>;
export declare const bookAppointment: (patientId: string, doctorId: string, startTime: Date, endTime: Date, symptomsText: string) => Promise<{
    doctor: {
        user: {
            id: string;
            email: string | null;
            empId: string | null;
            passwordHash: string | null;
            role: string;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        id: string;
        userId: string;
        name: string;
        specialisation: string;
        workingHoursStart: string;
        workingHoursEnd: string;
        slotDurationMins: number;
    };
    patient: {
        user: {
            id: string;
            email: string | null;
            empId: string | null;
            passwordHash: string | null;
            role: string;
            createdAt: Date;
            updatedAt: Date;
        };
    } & {
        id: string;
        userId: string;
        name: string;
        phone: string | null;
        age: number | null;
        sex: string | null;
        medicalHistory: string | null;
        pictureUrl: string | null;
    };
    preVisitForm: {
        id: string;
        appointmentId: string;
        symptomsText: string;
        llmUrgencyLevel: string | null;
        llmChiefComplaint: string | null;
        llmSuggestedQuestions: string | null;
        createdAt: Date;
    } | null;
} & {
    id: string;
    patientId: string;
    doctorId: string;
    startTime: Date;
    endTime: Date;
    status: string;
    googleCalendarEventId: string | null;
    createdAt: Date;
    updatedAt: Date;
}>;
//# sourceMappingURL=booking.d.ts.map