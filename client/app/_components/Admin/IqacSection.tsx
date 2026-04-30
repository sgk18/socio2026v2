"use client";
import React, { useState } from "react";
import { Control, FieldErrors, UseFormRegister, useFieldArray, Controller } from "react-hook-form";
import { EventFormData } from "@/app/lib/eventFormSchema";
import { iqacEventTypes, iqacTargetAudienceOptions } from "@/app/lib/eventFormSchema";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";

interface IqacSectionProps {
  control: Control<EventFormData>;
  register: UseFormRegister<EventFormData>;
  errors: FieldErrors<EventFormData>;
}

export default function IqacSection({ control, register, errors }: IqacSectionProps) {
  const [open, setOpen] = useState(false);

  const {
    fields: speakerFields,
    append: appendSpeaker,
    remove: removeSpeaker,
  } = useFieldArray({ control, name: "externalSpeakers" });

  const {
    fields: committeeFields,
    append: appendCommittee,
    remove: removeCommittee,
  } = useFieldArray({ control, name: "organisingCommittee" });

  return (
    <div className="border border-indigo-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-50 to-blue-50 hover:from-indigo-100 hover:to-blue-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
            <span className="text-indigo-700 text-xs font-bold">IQAC</span>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-800">IQAC & Compliance Details</p>
            <p className="text-xs text-gray-500">Optional — required for IQAC Activity Report</p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {open && (
        <div className="p-6 sm:p-7 space-y-6 bg-white">

          {/* IQAC Event Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              IQAC Event Type (Focus)
            </label>
            <Controller
              name="iqacEventType"
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                >
                  <option value="">Select event type for IQAC</option>
                  {iqacEventTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              )}
            />
          </div>

          {/* Target Audience */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Audience
            </label>
            <Controller
              name="targetAudience"
              control={control}
              render={({ field }) => {
                const selected: string[] = Array.isArray(field.value) ? field.value : [];
                const toggle = (opt: string) => {
                  const next = selected.includes(opt)
                    ? selected.filter((v) => v !== opt)
                    : [...selected, opt];
                  field.onChange(next);
                };
                return (
                  <div className="flex flex-wrap gap-2">
                    {iqacTargetAudienceOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggle(opt)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                          selected.includes(opt)
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                );
              }}
            />
          </div>

          {/* Blog Link */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Blog / Report Link <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              {...register("blogLink")}
              type="url"
              placeholder="https://..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            {errors.blogLink && (
              <p className="text-xs text-red-500 mt-1">{errors.blogLink.message}</p>
            )}
          </div>

          {/* Organising Committee */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                Organising Committee
              </label>
              <button
                type="button"
                onClick={() => appendCommittee({ name: "", role: "", email: "" })}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add member
              </button>
            </div>
            {committeeFields.length === 0 && (
              <p className="text-xs text-gray-400 italic">No committee members added yet.</p>
            )}
            <div className="space-y-2">
              {committeeFields.map((field, idx) => (
                <div key={field.id} className="grid grid-cols-3 gap-2 items-start">
                  <input
                    {...register(`organisingCommittee.${idx}.name`)}
                    placeholder="Full name *"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <input
                    {...register(`organisingCommittee.${idx}.role`)}
                    placeholder="Role / Designation"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <div className="flex gap-1">
                    <input
                      {...register(`organisingCommittee.${idx}.email`)}
                      placeholder="Email (optional)"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={() => removeCommittee(idx)}
                      className="p-2 text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* External Speakers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                External Speakers / Resource Persons
              </label>
              <button
                type="button"
                onClick={() => appendSpeaker({ name: "", designation: "", organization: "", contact: "", website: "" })}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add speaker
              </button>
            </div>
            {speakerFields.length === 0 && (
              <p className="text-xs text-gray-400 italic">No external speakers added yet.</p>
            )}
            <div className="space-y-3">
              {speakerFields.map((field, idx) => (
                <div key={field.id} className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Speaker {idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeSpeaker(idx)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      {...register(`externalSpeakers.${idx}.name`)}
                      placeholder="Full name *"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    />
                    <input
                      {...register(`externalSpeakers.${idx}.designation`)}
                      placeholder="Designation"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    />
                    <input
                      {...register(`externalSpeakers.${idx}.organization`)}
                      placeholder="Organization / Institution"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    />
                    <input
                      {...register(`externalSpeakers.${idx}.contact`)}
                      placeholder="Phone / Email"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    />
                    <input
                      {...register(`externalSpeakers.${idx}.website`)}
                      placeholder="Website (optional)"
                      className="col-span-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
