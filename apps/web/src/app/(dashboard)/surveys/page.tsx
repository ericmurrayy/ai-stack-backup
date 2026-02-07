'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Star,
  MessageSquare,
  TrendingUp,
  Users,
  Send,
  Clock,
  CheckCircle,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  X,
  Mail,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Meh,
  BarChart3,
  Plus,
} from 'lucide-react';

interface Survey {
  id: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  job_id?: string;
  job_number?: string;
  technician_id?: string;
  technician_name?: string;
  type: string;
  status: 'pending' | 'sent' | 'completed' | 'expired';
  questions: any[];
  responses?: any[];
  overall_rating?: number;
  nps_score?: number;
  would_recommend?: boolean;
  sent_at?: string;
  completed_at?: string;
  token: string;
  created_at: string;
}

interface Stats {
  total: number;
  completed: number;
  responseRate: number;
  avgRating: number;
  avgNps: number;
  npsBreakdown: {
    promoters: number;
    passives: number;
    detractors: number;
  };
}

const statusConfig = {
  pending: { label: 'Pending', color: 'default', icon: Clock },
  sent: { label: 'Sent', color: 'info', icon: Send },
  completed: { label: 'Completed', color: 'success', icon: CheckCircle },
  expired: { label: 'Expired', color: 'error', icon: AlertTriangle },
} as const;

export default function SurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [surveysRes, statsRes] = await Promise.all([
        fetch('/api/surveys'),
        fetch('/api/surveys?stats=true'),
      ]);

      if (surveysRes.ok) {
        const data = await surveysRes.json();
        setSurveys(data.surveys || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch surveys:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredSurveys = surveys.filter(survey => {
    const matchesFilter = filter === 'all' || survey.status === filter;
    const matchesSearch = !searchQuery ||
      survey.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      survey.job_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      survey.technician_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  async function handleSendSurvey(surveyId: string) {
    try {
      await fetch('/api/surveys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: surveyId,
          status: 'sent',
          sent_at: new Date().toISOString(),
        }),
      });
      fetchData();
    } catch (error) {
      console.error('Failed to send survey:', error);
    }
  }

  const calculateNpsScore = () => {
    if (!stats || stats.completed === 0) return 0;
    const { promoters, detractors } = stats.npsBreakdown;
    const total = promoters + stats.npsBreakdown.passives + detractors;
    if (total === 0) return 0;
    return Math.round(((promoters - detractors) / total) * 100);
  };

  if (loading) {
    return (
      <div>
        <Header title="Customer Surveys" />
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="h-16 bg-gray-200 rounded" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Customer Surveys" />

      <div className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Surveys</p>
                <p className="text-2xl font-bold text-slate-900">{stats?.total || 0}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Response Rate</p>
                <p className="text-2xl font-bold text-green-600">{stats?.responseRate || 0}%</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Star className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Avg Rating</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {stats?.avgRating?.toFixed(1) || '0.0'}
                </p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">NPS Score</p>
                <p className="text-2xl font-bold text-purple-600">{calculateNpsScore()}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Completed</p>
                <p className="text-2xl font-bold text-indigo-600">{stats?.completed || 0}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* NPS Breakdown */}
        {stats && stats.npsBreakdown && (
          <Card className="p-4">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-slate-400" />
              NPS Breakdown
            </h3>
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <ThumbsUp className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.npsBreakdown.promoters}</p>
                  <p className="text-xs text-slate-500">Promoters (9-10)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Meh className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{stats.npsBreakdown.passives}</p>
                  <p className="text-xs text-slate-500">Passives (7-8)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ThumbsDown className="w-5 h-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{stats.npsBreakdown.detractors}</p>
                  <p className="text-xs text-slate-500">Detractors (0-6)</p>
                </div>
              </div>
              <div className="ml-auto">
                <div className="w-48 h-4 bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-green-500"
                    style={{
                      width: `${(stats.npsBreakdown.promoters / (stats.npsBreakdown.promoters + stats.npsBreakdown.passives + stats.npsBreakdown.detractors || 1)) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-yellow-500"
                    style={{
                      width: `${(stats.npsBreakdown.passives / (stats.npsBreakdown.promoters + stats.npsBreakdown.passives + stats.npsBreakdown.detractors || 1)) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-red-500"
                    style={{
                      width: `${(stats.npsBreakdown.detractors / (stats.npsBreakdown.promoters + stats.npsBreakdown.passives + stats.npsBreakdown.detractors || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Filters and Actions */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search surveys..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="sent">Sent</option>
              <option value="completed">Completed</option>
              <option value="expired">Expired</option>
            </select>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Create Survey
          </Button>
        </div>

        {/* Surveys List */}
        <div className="space-y-4">
          {filteredSurveys.map((survey) => {
            const statusInfo = statusConfig[survey.status];

            return (
              <Card key={survey.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  {/* Survey Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900">
                        {survey.customer_name || 'Unknown Customer'}
                      </h3>
                      <Badge variant={statusInfo.color as any}>
                        {statusInfo.label}
                      </Badge>
                      {survey.would_recommend !== undefined && (
                        <Badge variant={survey.would_recommend ? 'success' : 'error'}>
                          {survey.would_recommend ? 'Would Recommend' : 'Needs Attention'}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                      {survey.job_number && (
                        <span className="flex items-center gap-1">
                          Job #{survey.job_number}
                        </span>
                      )}
                      {survey.technician_name && (
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {survey.technician_name}
                        </span>
                      )}
                      {survey.customer_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {survey.customer_email}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Scores and Actions */}
                  <div className="flex items-center gap-6">
                    {survey.status === 'completed' && (
                      <>
                        {survey.overall_rating !== undefined && (
                          <div className="text-center">
                            <div className="flex items-center gap-1">
                              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                              <span className="text-xl font-bold">{survey.overall_rating}</span>
                            </div>
                            <p className="text-xs text-slate-500">Rating</p>
                          </div>
                        )}
                        {survey.nps_score !== undefined && (
                          <div className="text-center">
                            <p className={`text-xl font-bold ${
                              survey.nps_score >= 9
                                ? 'text-green-600'
                                : survey.nps_score >= 7
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }`}>
                              {survey.nps_score}
                            </p>
                            <p className="text-xs text-slate-500">NPS</p>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex items-center gap-2">
                      {survey.status === 'pending' && (
                        <Button
                          variant="secondary"
                          onClick={() => handleSendSurvey(survey.id)}
                        >
                          <Send className="w-4 h-4 mr-1" />
                          Send
                        </Button>
                      )}
                      {survey.status === 'sent' && (
                        <a
                          href={`/survey/${survey.token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="View Survey"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => {
                          setSelectedSurvey(survey);
                          setShowDetailModal(true);
                        }}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-6 text-xs text-slate-500">
                  <span>Created: {formatDate(survey.created_at)}</span>
                  {survey.sent_at && <span>Sent: {formatDate(survey.sent_at)}</span>}
                  {survey.completed_at && <span>Completed: {formatDate(survey.completed_at)}</span>}
                </div>
              </Card>
            );
          })}

          {filteredSurveys.length === 0 && (
            <Card className="p-8 text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Surveys Found</h3>
              <p className="text-slate-500 mb-4">
                {searchQuery || filter !== 'all'
                  ? 'Try adjusting your search or filters'
                  : 'Surveys are automatically created after jobs are completed'}
              </p>
            </Card>
          )}
        </div>

        {/* Survey Detail Modal */}
        {showDetailModal && selectedSurvey && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Survey Details</h2>
                    <p className="text-sm text-slate-500">{selectedSurvey.customer_name}</p>
                  </div>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      setSelectedSurvey(null);
                    }}
                    className="p-2 hover:bg-slate-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Status</p>
                      <Badge variant={statusConfig[selectedSurvey.status].color as any}>
                        {statusConfig[selectedSurvey.status].label}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase">Job</p>
                      <p className="font-medium">#{selectedSurvey.job_number || 'N/A'}</p>
                    </div>
                  </div>

                  {selectedSurvey.status === 'completed' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        {selectedSurvey.overall_rating !== undefined && (
                          <div>
                            <p className="text-xs text-slate-500 uppercase">Overall Rating</p>
                            <div className="flex items-center gap-2">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-5 h-5 ${
                                    star <= selectedSurvey.overall_rating!
                                      ? 'text-yellow-500 fill-yellow-500'
                                      : 'text-slate-200'
                                  }`}
                                />
                              ))}
                              <span className="font-bold">{selectedSurvey.overall_rating}</span>
                            </div>
                          </div>
                        )}
                        {selectedSurvey.nps_score !== undefined && (
                          <div>
                            <p className="text-xs text-slate-500 uppercase">NPS Score</p>
                            <p className={`text-2xl font-bold ${
                              selectedSurvey.nps_score >= 9
                                ? 'text-green-600'
                                : selectedSurvey.nps_score >= 7
                                ? 'text-yellow-600'
                                : 'text-red-600'
                            }`}>
                              {selectedSurvey.nps_score}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Responses */}
                      {selectedSurvey.responses && selectedSurvey.responses.length > 0 && (
                        <div className="border-t pt-4">
                          <p className="text-xs text-slate-500 uppercase mb-2">Responses</p>
                          <div className="space-y-3">
                            {selectedSurvey.questions.map((question, idx) => {
                              const response = selectedSurvey.responses?.find(
                                r => r.question_id === question.id
                              );

                              return (
                                <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                                  <p className="text-sm font-medium text-slate-900 mb-1">
                                    {question.question}
                                  </p>
                                  <p className="text-sm text-slate-600">
                                    {response?.answer || 'No response'}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Timeline */}
                  <div className="border-t pt-4">
                    <p className="text-xs text-slate-500 uppercase mb-2">Timeline</p>
                    <div className="space-y-2 text-sm">
                      <p>Created: {formatDate(selectedSurvey.created_at)}</p>
                      {selectedSurvey.sent_at && <p>Sent: {formatDate(selectedSurvey.sent_at)}</p>}
                      {selectedSurvey.completed_at && (
                        <p>Completed: {formatDate(selectedSurvey.completed_at)}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowDetailModal(false);
                      setSelectedSurvey(null);
                    }}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
