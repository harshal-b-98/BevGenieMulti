'use client';

import React, { useState } from 'react';
import { X, User, Building, Briefcase, Package, AlertCircle, Edit2, Save } from 'lucide-react';
import type { PersonaScores } from '@/lib/session/types';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  persona: PersonaScores | null;
  onUpdatePersona: (updates: Partial<PersonaScores>) => void;
}

export function ProfileModal({ isOpen, onClose, persona, onUpdatePersona }: ProfileModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedPersona, setEditedPersona] = useState<any>({
    functional_role: persona?.detection_vectors?.functional_role || '',
    org_type: persona?.detection_vectors?.org_type || '',
    org_size: persona?.detection_vectors?.org_size || '',
    product_focus: persona?.detection_vectors?.product_focus || ''
  });

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdatePersona({
      detection_vectors: {
        ...persona?.detection_vectors,
        functional_role: editedPersona.functional_role,
        functional_role_confidence: 100,
        org_type: editedPersona.org_type,
        org_type_confidence: 100,
        org_size: editedPersona.org_size,
        org_size_confidence: 100,
        product_focus: editedPersona.product_focus,
        product_focus_confidence: 100,
        vectors_updated_at: Date.now(),
      } as any
    });
    setIsEditing(false);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return 'text-green-500';
    if (confidence >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  const painPoints = persona?.pain_points_detected || [];
  const detectionVectors = persona?.detection_vectors;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#0A1628] to-[#0D1B2E] text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-[#06B6D4] rounded-full flex items-center justify-center">
                <User size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Your Profile</h2>
                <p className="text-sm text-white/70">AI-detected persona & preferences</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Edit Mode Toggle */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <AlertCircle size={16} />
              <span>
                {isEditing ? 'Make corrections below' : 'These insights are auto-detected from your interactions'}
              </span>
            </div>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#06B6D4] text-white rounded-lg hover:bg-[#0598B8] transition-colors"
              >
                <Edit2 size={16} />
                <span>Edit Profile</span>
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Save size={16} />
                <span>Save Changes</span>
              </button>
            )}
          </div>

          {/* Detection Vectors */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-[#0A1628] flex items-center gap-2">
              <Briefcase size={20} className="text-[#06B6D4]" />
              Detected Profile
            </h3>

            {/* Functional Role */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex justify-between items-start mb-2">
                <label className="text-sm font-semibold text-gray-700">Your Role</label>
                {!isEditing && detectionVectors?.functional_role_confidence !== undefined && (
                  <span className={`text-xs font-medium ${getConfidenceColor(detectionVectors.functional_role_confidence)}`}>
                    {detectionVectors.functional_role_confidence}% confidence
                  </span>
                )}
              </div>
              {isEditing ? (
                <select
                  value={editedPersona.functional_role}
                  onChange={(e) => setEditedPersona({ ...editedPersona, functional_role: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent"
                >
                  <option value="">Select your role</option>
                  <option value="sales">Sales</option>
                  <option value="marketing">Marketing</option>
                  <option value="operations">Operations</option>
                  <option value="compliance">Compliance</option>
                  <option value="executive">Executive</option>
                </select>
              ) : (
                <p className="text-gray-900 font-medium capitalize">
                  {detectionVectors?.functional_role || 'Not detected yet'}
                </p>
              )}
            </div>

            {/* Organization Type */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex justify-between items-start mb-2">
                <label className="text-sm font-semibold text-gray-700">Organization Type</label>
                {!isEditing && detectionVectors?.org_type_confidence !== undefined && (
                  <span className={`text-xs font-medium ${getConfidenceColor(detectionVectors.org_type_confidence)}`}>
                    {detectionVectors.org_type_confidence}% confidence
                  </span>
                )}
              </div>
              {isEditing ? (
                <select
                  value={editedPersona.org_type}
                  onChange={(e) => setEditedPersona({ ...editedPersona, org_type: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent"
                >
                  <option value="">Select organization type</option>
                  <option value="supplier">Supplier</option>
                  <option value="distributor">Distributor</option>
                  <option value="craft">Craft Brewery</option>
                </select>
              ) : (
                <p className="text-gray-900 font-medium capitalize">
                  {detectionVectors?.org_type || 'Not detected yet'}
                </p>
              )}
            </div>

            {/* Organization Size */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex justify-between items-start mb-2">
                <label className="text-sm font-semibold text-gray-700">Organization Size</label>
                {!isEditing && detectionVectors?.org_size_confidence !== undefined && (
                  <span className={`text-xs font-medium ${getConfidenceColor(detectionVectors.org_size_confidence)}`}>
                    {detectionVectors.org_size_confidence}% confidence
                  </span>
                )}
              </div>
              {isEditing ? (
                <select
                  value={editedPersona.org_size}
                  onChange={(e) => setEditedPersona({ ...editedPersona, org_size: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent"
                >
                  <option value="">Select organization size</option>
                  <option value="small">Small (1-50 employees)</option>
                  <option value="mid">Mid-sized (51-500 employees)</option>
                  <option value="large">Large (500+ employees)</option>
                </select>
              ) : (
                <p className="text-gray-900 font-medium capitalize">
                  {detectionVectors?.org_size || 'Not detected yet'}
                </p>
              )}
            </div>

            {/* Product Focus */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex justify-between items-start mb-2">
                <label className="text-sm font-semibold text-gray-700">Product Focus</label>
                {!isEditing && detectionVectors?.product_focus_confidence !== undefined && (
                  <span className={`text-xs font-medium ${getConfidenceColor(detectionVectors.product_focus_confidence)}`}>
                    {detectionVectors.product_focus_confidence}% confidence
                  </span>
                )}
              </div>
              {isEditing ? (
                <input
                  type="text"
                  value={editedPersona.product_focus}
                  onChange={(e) => setEditedPersona({ ...editedPersona, product_focus: e.target.value })}
                  placeholder="e.g., beer, wine, spirits"
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#06B6D4] focus:border-transparent"
                />
              ) : (
                <p className="text-gray-900 font-medium capitalize">
                  {detectionVectors?.product_focus || 'Not detected yet'}
                </p>
              )}
            </div>
          </div>

          {/* Pain Points */}
          {painPoints.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-[#0A1628] flex items-center gap-2">
                <AlertCircle size={20} className="text-[#06B6D4]" />
                Detected Pain Points
              </h3>
              <div className="space-y-2">
                {painPoints.map((painPoint, index) => (
                  <div key={index} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm font-medium text-orange-900 capitalize">
                      {painPoint.replace(/_/g, ' ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#06B6D4]">
                {persona?.total_interactions || 0}
              </p>
              <p className="text-sm text-gray-600">Total Interactions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-[#06B6D4]">
                {persona?.overall_confidence || 0}%
              </p>
              <p className="text-sm text-gray-600">Overall Confidence</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
