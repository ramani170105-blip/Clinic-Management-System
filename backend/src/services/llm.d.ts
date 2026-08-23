export declare const generatePreVisitSummary: (symptoms: string) => Promise<{
    urgencyLevel: any;
    chiefComplaint: any;
    suggestedQuestions: any;
}>;
export declare const generatePostVisitSummary: (clinicalNotes: string) => Promise<{
    patientSummary: any;
    medicationSchedule: any;
    followUpSteps: any;
}>;
export declare const generateClinicalNotes: (patientName: string, age: string, sex: string, symptoms: string, chiefComplaint: string, doctorObservations: string) => Promise<{
    clinicalNotes: any;
    prescription: any;
    recommendedFrequencyHours: any;
}>;
//# sourceMappingURL=llm.d.ts.map