"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateClinicalNotes = exports.generatePostVisitSummary = exports.generatePreVisitSummary = void 0;
const genai_1 = require("@google/genai");
const ai = new genai_1.GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY || ''
});
const generatePreVisitSummary = async (symptoms) => {
    try {
        const prompt = `You are an expert medical AI assistant. Your task is to process raw patient complaints and symptoms.
    The input may contain severe spelling mistakes, poor grammar, conversational filler, and irrelevant information.
    You must aggressively filter out the noise, understand the underlying medical symptoms, and provide a highly detailed, professional clinical summary for the doctor.
    
    Return a JSON object with exactly the following keys (no markdown wrapping): 
    "urgencyLevel" (Low / Medium / High - based on clinical triage), 
    "chiefComplaint" (string - a detailed professional clinical summary of the symptoms, ignoring spelling mistakes and irrelevant chatter), 
    "suggestedQuestions" (array of 3 strings - highly relevant medical follow-up questions). 
    
    Raw Patient Input: ${symptoms}`;
        const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
        });
        const text = response.text || "{}";
        // Attempt to parse JSON safely
        const cleanText = text.replace(/```json\n|\n```|```/g, '').trim();
        const result = JSON.parse(cleanText);
        return {
            urgencyLevel: result.urgencyLevel || 'Medium',
            chiefComplaint: result.chiefComplaint || 'Unknown',
            suggestedQuestions: result.suggestedQuestions?.join(' | ') || '',
        };
    }
    catch (error) {
        console.error('LLM Pre-Visit Summary failed', error);
        // Graceful fallback
        return {
            urgencyLevel: 'Medium',
            chiefComplaint: 'Fallback triggered, parsing failed',
            suggestedQuestions: 'What is the exact timeline of these symptoms? | Any previous medical history related to this? | Are you taking any medications?',
        };
    }
};
exports.generatePreVisitSummary = generatePreVisitSummary;
const generatePostVisitSummary = async (clinicalNotes) => {
    try {
        const prompt = `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps. Return a JSON object with exactly these keys:
    "patientSummary" (string), "medicationSchedule" (string), "followUpSteps" (string).
    Notes: ${clinicalNotes}`;
        const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
        });
        const text = response.text || "{}";
        const cleanText = text.replace(/```json\n|\n```|```/g, '').trim();
        const result = JSON.parse(cleanText);
        return {
            patientSummary: result.patientSummary || '',
            medicationSchedule: result.medicationSchedule || '',
            followUpSteps: result.followUpSteps || '',
        };
    }
    catch (error) {
        console.error('LLM Post-Visit Summary failed', error);
        // Graceful fallback
        return {
            patientSummary: 'Please refer to the doctor directly for summary. (AI unavailable)',
            medicationSchedule: 'Follow the prescription paper provided.',
            followUpSteps: 'Please book a follow-up if symptoms persist.',
        };
    }
};
exports.generatePostVisitSummary = generatePostVisitSummary;
const generateClinicalNotes = async (patientName, age, sex, symptoms, chiefComplaint, doctorObservations) => {
    try {
        const prompt = `You are a senior physician assistant AI. Based on the following patient data, generate professional clinical notes and a prescription.

Patient: ${patientName}, Age: ${age}, Sex: ${sex}
Patient's Raw Symptoms: ${symptoms}
AI Chief Complaint Summary: ${chiefComplaint}
Doctor's Observations During Visit: ${doctorObservations}

Return a JSON object with exactly these keys (no markdown wrapping):
"clinicalNotes" (string - detailed, professional clinical notes in SOAP format: Subjective, Objective, Assessment, Plan. Each section should be on a new line prefixed with its label.),
"prescription" (string - a realistic prescription with medication names, dosages, frequency, and duration. Format each medication on a new line like: "MedicationName DosageMg - Frequency - Duration"),
"recommendedFrequencyHours" (number - suggested medication reminder frequency in hours, e.g. 8 for every 8 hours)`;
        const response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: prompt,
        });
        const text = response.text || "{}";
        const cleanText = text.replace(/```json\n|\n```|```/g, '').trim();
        const result = JSON.parse(cleanText);
        return {
            clinicalNotes: result.clinicalNotes || '',
            prescription: result.prescription || '',
            recommendedFrequencyHours: result.recommendedFrequencyHours || 8,
        };
    }
    catch (error) {
        console.error('LLM Clinical Notes generation failed', error);
        return {
            clinicalNotes: 'AI generation failed. Please write notes manually.',
            prescription: '',
            recommendedFrequencyHours: 8,
        };
    }
};
exports.generateClinicalNotes = generateClinicalNotes;
//# sourceMappingURL=llm.js.map