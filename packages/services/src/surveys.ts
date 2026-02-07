/**
 * Customer Satisfaction Surveys Service
 * ======================================
 * Collect feedback after job completion
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

export type SurveyType = 'post_job' | 'follow_up' | 'nps' | 'custom';
export type SurveyStatus = 'pending' | 'sent' | 'completed' | 'expired';
export type QuestionType = 'rating' | 'nps' | 'text' | 'multiple_choice' | 'yes_no';

export interface SurveyQuestion {
  id: string;
  type: QuestionType;
  question: string;
  required: boolean;
  options?: string[]; // for multiple choice
  min_label?: string; // for rating/nps (e.g., "Not at all likely")
  max_label?: string; // for rating/nps (e.g., "Extremely likely")
  order: number;
}

export interface SurveyResponse {
  question_id: string;
  answer: string | number;
  comment?: string;
}

export interface Survey {
  id: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  job_id?: string;
  job_number?: string;
  technician_id?: string;
  technician_name?: string;

  type: SurveyType;
  status: SurveyStatus;

  // Survey content
  questions: SurveyQuestion[];
  responses?: SurveyResponse[];

  // Scores
  overall_rating?: number; // 1-5
  nps_score?: number; // 0-10
  would_recommend?: boolean;

  // Timing
  sent_at?: string;
  completed_at?: string;
  expires_at?: string;

  // Access
  token: string;
  public_url?: string;

  // Metadata
  created_at: string;
  updated_at?: string;
}

export interface SurveyTemplate {
  id: string;
  name: string;
  type: SurveyType;
  questions: SurveyQuestion[];
  description?: string;
  is_default: boolean;
}

// Pre-defined survey templates
export const defaultSurveyTemplates: SurveyTemplate[] = [
  {
    id: 'post-job-standard',
    name: 'Post-Job Survey (Standard)',
    type: 'post_job',
    description: 'Standard feedback survey sent after job completion',
    is_default: true,
    questions: [
      {
        id: 'q1',
        type: 'rating',
        question: 'How would you rate the overall quality of service?',
        required: true,
        min_label: 'Poor',
        max_label: 'Excellent',
        order: 1,
      },
      {
        id: 'q2',
        type: 'rating',
        question: 'How would you rate our technician\'s professionalism?',
        required: true,
        min_label: 'Poor',
        max_label: 'Excellent',
        order: 2,
      },
      {
        id: 'q3',
        type: 'rating',
        question: 'How would you rate the timeliness of our service?',
        required: true,
        min_label: 'Poor',
        max_label: 'Excellent',
        order: 3,
      },
      {
        id: 'q4',
        type: 'rating',
        question: 'How would you rate the value for money?',
        required: true,
        min_label: 'Poor',
        max_label: 'Excellent',
        order: 4,
      },
      {
        id: 'q5',
        type: 'nps',
        question: 'How likely are you to recommend us to friends or family?',
        required: true,
        min_label: 'Not at all likely',
        max_label: 'Extremely likely',
        order: 5,
      },
      {
        id: 'q6',
        type: 'text',
        question: 'What did we do well?',
        required: false,
        order: 6,
      },
      {
        id: 'q7',
        type: 'text',
        question: 'What could we improve?',
        required: false,
        order: 7,
      },
    ],
  },
  {
    id: 'post-job-quick',
    name: 'Post-Job Survey (Quick)',
    type: 'post_job',
    description: 'Short 3-question survey for quick feedback',
    is_default: false,
    questions: [
      {
        id: 'q1',
        type: 'rating',
        question: 'How satisfied are you with our service?',
        required: true,
        min_label: 'Very Unsatisfied',
        max_label: 'Very Satisfied',
        order: 1,
      },
      {
        id: 'q2',
        type: 'nps',
        question: 'How likely are you to recommend us?',
        required: true,
        min_label: 'Not at all likely',
        max_label: 'Extremely likely',
        order: 2,
      },
      {
        id: 'q3',
        type: 'text',
        question: 'Any additional comments?',
        required: false,
        order: 3,
      },
    ],
  },
  {
    id: 'nps-only',
    name: 'NPS Survey',
    type: 'nps',
    description: 'Single question Net Promoter Score survey',
    is_default: false,
    questions: [
      {
        id: 'q1',
        type: 'nps',
        question: 'On a scale of 0-10, how likely are you to recommend our services to a friend or colleague?',
        required: true,
        min_label: 'Not at all likely',
        max_label: 'Extremely likely',
        order: 1,
      },
      {
        id: 'q2',
        type: 'text',
        question: 'What is the primary reason for your score?',
        required: false,
        order: 2,
      },
    ],
  },
  {
    id: 'follow-up',
    name: 'Follow-Up Survey',
    type: 'follow_up',
    description: 'Survey sent a week after service to check on results',
    is_default: false,
    questions: [
      {
        id: 'q1',
        type: 'yes_no',
        question: 'Is the issue that was addressed still resolved?',
        required: true,
        order: 1,
      },
      {
        id: 'q2',
        type: 'rating',
        question: 'How satisfied are you with the lasting results of our service?',
        required: true,
        min_label: 'Very Unsatisfied',
        max_label: 'Very Satisfied',
        order: 2,
      },
      {
        id: 'q3',
        type: 'multiple_choice',
        question: 'Would you use our services again?',
        required: true,
        options: ['Definitely yes', 'Probably yes', 'Not sure', 'Probably not', 'Definitely not'],
        order: 3,
      },
      {
        id: 'q4',
        type: 'text',
        question: 'Any additional feedback?',
        required: false,
        order: 4,
      },
    ],
  },
];

export const surveysService = {
  /**
   * Generate unique survey token
   */
  generateToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  },

  /**
   * Get all templates
   */
  getTemplates(): SurveyTemplate[] {
    return defaultSurveyTemplates;
  },

  /**
   * Get template by ID
   */
  getTemplateById(templateId: string): SurveyTemplate | undefined {
    return defaultSurveyTemplates.find(t => t.id === templateId);
  },

  /**
   * Get default template
   */
  getDefaultTemplate(): SurveyTemplate {
    return defaultSurveyTemplates.find(t => t.is_default) || defaultSurveyTemplates[0];
  },

  /**
   * Create a survey for a job
   */
  async createForJob(
    jobId: string,
    customerId: string,
    customerInfo: { name?: string; email?: string },
    technicianInfo?: { id?: string; name?: string },
    templateId?: string
  ): Promise<{ success: boolean; surveyId?: string; token?: string; publicUrl?: string; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const template = templateId
      ? this.getTemplateById(templateId)
      : this.getDefaultTemplate();

    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14); // 2 weeks expiry

    const survey: Partial<Survey> = {
      customer_id: customerId,
      customer_name: customerInfo.name,
      customer_email: customerInfo.email,
      job_id: jobId,
      technician_id: technicianInfo?.id,
      technician_name: technicianInfo?.name,
      type: template.type,
      status: 'pending',
      questions: template.questions,
      token,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('surveys')
      .insert(survey)
      .select('id')
      .single();

    if (error) {
      console.error('[Surveys] Create error:', error);
      return { success: false, error: error.message };
    }

    const publicUrl = `/survey/${token}`;
    return { success: true, surveyId: data.id, token, publicUrl };
  },

  /**
   * Get survey by token (for public access)
   */
  async getByToken(token: string): Promise<Survey | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('surveys')
      .select('*')
      .eq('token', token)
      .single();

    if (error) {
      console.error('[Surveys] Get by token error:', error);
      return null;
    }

    return data;
  },

  /**
   * Submit survey responses
   */
  async submitResponses(
    token: string,
    responses: SurveyResponse[]
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    // Get survey
    const survey = await this.getByToken(token);
    if (!survey) {
      return { success: false, error: 'Survey not found' };
    }

    if (survey.status === 'completed') {
      return { success: false, error: 'Survey already completed' };
    }

    if (survey.status === 'expired' || (survey.expires_at && new Date(survey.expires_at) < new Date())) {
      return { success: false, error: 'Survey has expired' };
    }

    // Calculate scores
    let overallRating: number | undefined;
    let npsScore: number | undefined;
    let wouldRecommend: boolean | undefined;

    const ratingResponses = responses.filter(r => {
      const question = survey.questions.find(q => q.id === r.question_id);
      return question?.type === 'rating';
    });

    if (ratingResponses.length > 0) {
      overallRating = Math.round(
        ratingResponses.reduce((sum, r) => sum + (Number(r.answer) || 0), 0) / ratingResponses.length * 10
      ) / 10;
    }

    const npsResponse = responses.find(r => {
      const question = survey.questions.find(q => q.id === r.question_id);
      return question?.type === 'nps';
    });

    if (npsResponse) {
      npsScore = Number(npsResponse.answer);
      wouldRecommend = npsScore >= 7;
    }

    // Update survey
    const { error } = await supabase
      .from('surveys')
      .update({
        responses,
        overall_rating: overallRating,
        nps_score: npsScore,
        would_recommend: wouldRecommend,
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('token', token);

    if (error) {
      console.error('[Surveys] Submit error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  /**
   * Mark survey as sent
   */
  async markSent(surveyId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Database not configured' };
    }

    const { error } = await supabase
      .from('surveys')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', surveyId);

    if (error) {
      console.error('[Surveys] Mark sent error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  /**
   * Get surveys with filters
   */
  async getSurveys(filter: {
    status?: SurveyStatus;
    customer_id?: string;
    job_id?: string;
    technician_id?: string;
    limit?: number;
  } = {}): Promise<Survey[]> {
    if (!supabase) return [];

    let query = supabase
      .from('surveys')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter.status) {
      query = query.eq('status', filter.status);
    }
    if (filter.customer_id) {
      query = query.eq('customer_id', filter.customer_id);
    }
    if (filter.job_id) {
      query = query.eq('job_id', filter.job_id);
    }
    if (filter.technician_id) {
      query = query.eq('technician_id', filter.technician_id);
    }
    if (filter.limit) {
      query = query.limit(filter.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[Surveys] Query error:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Get survey statistics
   */
  async getStats(filter: {
    startDate?: string;
    endDate?: string;
    technician_id?: string;
  } = {}): Promise<{
    total: number;
    completed: number;
    responseRate: number;
    avgRating: number;
    avgNps: number;
    npsBreakdown: { promoters: number; passives: number; detractors: number };
  }> {
    if (!supabase) {
      return {
        total: 0,
        completed: 0,
        responseRate: 0,
        avgRating: 0,
        avgNps: 0,
        npsBreakdown: { promoters: 0, passives: 0, detractors: 0 },
      };
    }

    let query = supabase
      .from('surveys')
      .select('status, overall_rating, nps_score, completed_at');

    if (filter.startDate) {
      query = query.gte('created_at', filter.startDate);
    }
    if (filter.endDate) {
      query = query.lte('created_at', filter.endDate);
    }
    if (filter.technician_id) {
      query = query.eq('technician_id', filter.technician_id);
    }

    const { data } = await query;

    if (!data || data.length === 0) {
      return {
        total: 0,
        completed: 0,
        responseRate: 0,
        avgRating: 0,
        avgNps: 0,
        npsBreakdown: { promoters: 0, passives: 0, detractors: 0 },
      };
    }

    const completed = data.filter(s => s.status === 'completed');
    const withRatings = completed.filter(s => s.overall_rating != null);
    const withNps = completed.filter(s => s.nps_score != null);

    const avgRating = withRatings.length > 0
      ? Math.round(withRatings.reduce((sum, s) => sum + (s.overall_rating || 0), 0) / withRatings.length * 10) / 10
      : 0;

    const avgNps = withNps.length > 0
      ? Math.round(withNps.reduce((sum, s) => sum + (s.nps_score || 0), 0) / withNps.length * 10) / 10
      : 0;

    const npsBreakdown = {
      promoters: withNps.filter(s => (s.nps_score || 0) >= 9).length,
      passives: withNps.filter(s => (s.nps_score || 0) >= 7 && (s.nps_score || 0) < 9).length,
      detractors: withNps.filter(s => (s.nps_score || 0) < 7).length,
    };

    return {
      total: data.length,
      completed: completed.length,
      responseRate: Math.round((completed.length / data.length) * 100),
      avgRating,
      avgNps,
      npsBreakdown,
    };
  },

  /**
   * Get technician ratings
   */
  async getTechnicianRatings(): Promise<Array<{
    technician_id: string;
    technician_name: string;
    avgRating: number;
    totalSurveys: number;
    avgNps: number;
  }>> {
    if (!supabase) return [];

    const { data } = await supabase
      .from('surveys')
      .select('technician_id, technician_name, overall_rating, nps_score')
      .eq('status', 'completed')
      .not('technician_id', 'is', null);

    if (!data) return [];

    const techMap = new Map<string, {
      name: string;
      ratings: number[];
      npsScores: number[];
    }>();

    data.forEach(survey => {
      if (!survey.technician_id) return;

      if (!techMap.has(survey.technician_id)) {
        techMap.set(survey.technician_id, {
          name: survey.technician_name || 'Unknown',
          ratings: [],
          npsScores: [],
        });
      }

      const tech = techMap.get(survey.technician_id)!;
      if (survey.overall_rating != null) {
        tech.ratings.push(survey.overall_rating);
      }
      if (survey.nps_score != null) {
        tech.npsScores.push(survey.nps_score);
      }
    });

    return Array.from(techMap.entries()).map(([techId, tech]) => ({
      technician_id: techId,
      technician_name: tech.name,
      avgRating: tech.ratings.length > 0
        ? Math.round(tech.ratings.reduce((a, b) => a + b, 0) / tech.ratings.length * 10) / 10
        : 0,
      totalSurveys: tech.ratings.length,
      avgNps: tech.npsScores.length > 0
        ? Math.round(tech.npsScores.reduce((a, b) => a + b, 0) / tech.npsScores.length * 10) / 10
        : 0,
    }));
  },
};

export default surveysService;
