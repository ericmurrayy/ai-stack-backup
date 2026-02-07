'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Star,
  CheckCircle,
  Clock,
  AlertCircle,
  Send,
  ThumbsUp,
  ThumbsDown,
  Meh,
} from 'lucide-react';

interface Question {
  id: string;
  type: 'rating' | 'nps' | 'text' | 'multiple_choice' | 'yes_no';
  question: string;
  required: boolean;
  options?: string[];
  min_label?: string;
  max_label?: string;
  order: number;
}

interface Survey {
  id: string;
  customer_name?: string;
  job_number?: string;
  technician_name?: string;
  type: string;
  status: string;
  questions: Question[];
  expires_at?: string;
}

interface SurveyResponse {
  question_id: string;
  answer: string | number;
}

export default function SurveyPage() {
  const params = useParams();
  const token = params.token as string;

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [responses, setResponses] = useState<Record<string, string | number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSurvey() {
      try {
        // In production, this would fetch from /api/surveys/[token]
        // For demo, use mock data
        const mockSurvey: Survey = {
          id: '1',
          customer_name: 'Valued Customer',
          job_number: 'J-001',
          technician_name: 'Mike Johnson',
          type: 'post_job',
          status: 'sent',
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
              question: "How would you rate our technician's professionalism?",
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
              type: 'nps',
              question: 'How likely are you to recommend us to friends or family?',
              required: true,
              min_label: 'Not at all likely',
              max_label: 'Extremely likely',
              order: 4,
            },
            {
              id: 'q5',
              type: 'text',
              question: 'What did we do well?',
              required: false,
              order: 5,
            },
            {
              id: 'q6',
              type: 'text',
              question: 'What could we improve?',
              required: false,
              order: 6,
            },
          ],
        };

        setSurvey(mockSurvey);
      } catch (err) {
        setError('Failed to load survey');
      } finally {
        setLoading(false);
      }
    }

    fetchSurvey();
  }, [token]);

  const handleResponse = (questionId: string, answer: string | number) => {
    setResponses(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async () => {
    if (!survey) return;

    // Validate required questions
    const missingRequired = survey.questions
      .filter(q => q.required && responses[q.id] === undefined)
      .map(q => q.question);

    if (missingRequired.length > 0) {
      setError('Please answer all required questions');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const formattedResponses: SurveyResponse[] = Object.entries(responses).map(([question_id, answer]) => ({
        question_id,
        answer,
      }));

      await fetch('/api/surveys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          responses: formattedResponses,
          status: 'completed',
          completed_at: new Date().toISOString(),
        }),
      });

      setSubmitted(true);
    } catch (err) {
      setError('Failed to submit survey. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderRating = (question: Question) => {
    const currentValue = responses[question.id] as number | undefined;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{question.min_label || 'Poor'}</span>
          <span>{question.max_label || 'Excellent'}</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              onClick={() => handleResponse(question.id, value)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                currentValue === value
                  ? 'bg-yellow-400 text-white scale-110'
                  : currentValue && currentValue >= value
                  ? 'bg-yellow-100 text-yellow-600'
                  : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
              }`}
            >
              <Star
                className={`w-6 h-6 ${
                  currentValue && currentValue >= value ? 'fill-current' : ''
                }`}
              />
            </button>
          ))}
        </div>
        {currentValue && (
          <p className="text-center text-sm text-slate-600">
            {currentValue === 5 && 'Excellent!'}
            {currentValue === 4 && 'Good'}
            {currentValue === 3 && 'Average'}
            {currentValue === 2 && 'Below Average'}
            {currentValue === 1 && 'Poor'}
          </p>
        )}
      </div>
    );
  };

  const renderNPS = (question: Question) => {
    const currentValue = responses[question.id] as number | undefined;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{question.min_label || '0 - Not at all likely'}</span>
          <span>{question.max_label || '10 - Extremely likely'}</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
            <button
              key={value}
              onClick={() => handleResponse(question.id, value)}
              className={`w-10 h-10 rounded-lg font-medium transition-all ${
                currentValue === value
                  ? value >= 9
                    ? 'bg-green-500 text-white'
                    : value >= 7
                    ? 'bg-yellow-500 text-white'
                    : 'bg-red-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        {currentValue !== undefined && (
          <div className="flex items-center justify-center gap-2 text-sm">
            {currentValue >= 9 && (
              <>
                <ThumbsUp className="w-4 h-4 text-green-500" />
                <span className="text-green-600">Promoter - Thank you!</span>
              </>
            )}
            {currentValue >= 7 && currentValue < 9 && (
              <>
                <Meh className="w-4 h-4 text-yellow-500" />
                <span className="text-yellow-600">Passive</span>
              </>
            )}
            {currentValue < 7 && (
              <>
                <ThumbsDown className="w-4 h-4 text-red-500" />
                <span className="text-red-600">We&apos;d love to improve</span>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderText = (question: Question) => {
    return (
      <textarea
        value={(responses[question.id] as string) || ''}
        onChange={(e) => handleResponse(question.id, e.target.value)}
        placeholder="Your feedback..."
        rows={3}
        className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    );
  };

  const renderMultipleChoice = (question: Question) => {
    const currentValue = responses[question.id] as string | undefined;

    return (
      <div className="space-y-2">
        {question.options?.map((option) => (
          <button
            key={option}
            onClick={() => handleResponse(question.id, option)}
            className={`w-full px-4 py-3 text-left rounded-lg border transition-all ${
              currentValue === option
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    );
  };

  const renderYesNo = (question: Question) => {
    const currentValue = responses[question.id] as string | undefined;

    return (
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => handleResponse(question.id, 'yes')}
          className={`px-8 py-4 rounded-lg font-medium transition-all ${
            currentValue === 'yes'
              ? 'bg-green-500 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Yes
        </button>
        <button
          onClick={() => handleResponse(question.id, 'no')}
          className={`px-8 py-4 rounded-lg font-medium transition-all ${
            currentValue === 'no'
              ? 'bg-red-500 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          No
        </button>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="p-8 text-center">
          <Clock className="w-12 h-12 mx-auto mb-4 text-blue-500 animate-pulse" />
          <p className="text-slate-600">Loading survey...</p>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Thank You!</h1>
          <p className="text-slate-600 mb-6">
            Your feedback has been submitted successfully. We appreciate you taking the time to help us improve.
          </p>
          <p className="text-sm text-slate-500">
            You can close this page now.
          </p>
        </Card>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">Survey Not Found</h1>
          <p className="text-slate-600">
            This survey may have expired or the link is invalid.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <Card className="p-6 mb-6 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Star className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            We Value Your Feedback
          </h1>
          <p className="text-slate-600">
            {survey.customer_name && `Hi ${survey.customer_name}, `}
            Please take a moment to rate your recent service experience
            {survey.job_number && ` (Job #${survey.job_number})`}
            {survey.technician_name && ` with ${survey.technician_name}`}.
          </p>
        </Card>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Questions */}
        <div className="space-y-6">
          {survey.questions
            .sort((a, b) => a.order - b.order)
            .map((question, index) => (
              <Card key={question.id} className="p-6">
                <div className="mb-4">
                  <span className="text-xs text-blue-600 font-medium">
                    Question {index + 1} of {survey.questions.length}
                    {question.required && <span className="text-red-500 ml-1">*</span>}
                  </span>
                  <h3 className="text-lg font-medium text-slate-900 mt-1">
                    {question.question}
                  </h3>
                </div>

                {question.type === 'rating' && renderRating(question)}
                {question.type === 'nps' && renderNPS(question)}
                {question.type === 'text' && renderText(question)}
                {question.type === 'multiple_choice' && renderMultipleChoice(question)}
                {question.type === 'yes_no' && renderYesNo(question)}
              </Card>
            ))}
        </div>

        {/* Submit Button */}
        <div className="mt-6">
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 text-lg"
          >
            {submitting ? (
              <>
                <Clock className="w-5 h-5 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Submit Feedback
              </>
            )}
          </Button>
          <p className="text-center text-xs text-slate-500 mt-4">
            Your responses are anonymous and help us improve our service.
          </p>
        </div>
      </div>
    </div>
  );
}
