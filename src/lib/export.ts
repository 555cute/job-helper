import type { AppSettings, JobPost, ResumeSection } from '../types'
import { resumeText } from './match'

export function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportJobs(jobs: JobPost[], resume: ResumeSection[], settings: AppSettings) {
  const prefix = settings.export.filenamePrefix || 'job-helper'
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const format = settings.export.defaultFormat

  if (format === 'json') {
    const payload = {
      exportedAt: new Date().toISOString(),
      jobs,
      ...(settings.export.includeResume ? { resume } : {}),
    }
    downloadText(`${prefix}-jobs-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json')
    return `${prefix}-jobs-${stamp}.json`
  }

  if (format === 'txt') {
    const lines = jobs.map(
      (j, i) =>
        `${i + 1}. ${j.title} | ${j.company} | ${j.city} | ${j.salary} | ${j.source} | match=${j.match} | status=${j.applyStatus || 'new'}${j.starred ? ' | 收藏' : ''}\n${j.link}${
          settings.export.includeMatchReason ? `\n${j.reason}` : ''
        }${j.note ? `\n备注：${j.note}` : ''}`,
    )
    const body =
      (settings.export.includeResume ? `简历摘要\n${resumeText(resume)}\n\n` : '') + lines.join('\n\n')
    downloadText(`${prefix}-jobs-${stamp}.txt`, body)
    return `${prefix}-jobs-${stamp}.txt`
  }

  const mdJobs = jobs
    .map((j) => {
      const reason = settings.export.includeMatchReason ? `\n- 匹配理由：${j.reason}` : ''
      return `### ${j.title}\n- 公司：${j.company}\n- 城市：${j.city}\n- 薪资：${j.salary}\n- 来源：${j.source}\n- 匹配：${j.match}\n- 状态：${j.applyStatus || 'new'}\n- 收藏：${j.starred ? '是' : '否'}\n- 链接：${j.link || '-'}${reason}${j.note ? `\n- 备注：${j.note}` : ''}${j.pitch ? `\n- 话术：${j.pitch}` : ''}`
    })
    .join('\n\n')

  const md =
    `# ${settings.general.appName} 导出\n\n` +
    `导出时间：${new Date().toLocaleString('zh-CN')}\n\n` +
    (settings.export.includeResume ? `## 简历\n\n${resumeText(resume)}\n\n` : '') +
    `## 岗位（${jobs.length}）\n\n${mdJobs}\n`

  downloadText(`${prefix}-jobs-${stamp}.md`, md, 'text/markdown;charset=utf-8')
  return `${prefix}-jobs-${stamp}.md`
}

export function exportResume(sections: ResumeSection[], settings: AppSettings) {
  const prefix = settings.export.filenamePrefix || 'job-helper'
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const name = `${prefix}-resume-${stamp}.md`
  const md =
    `# 简历 · ${settings.resume.targetRole}\n\n` +
    sections.map((s) => `## ${s.title}\n\n${s.content}\n`).join('\n')
  downloadText(name, md, 'text/markdown;charset=utf-8')
  return name
}

/** 单岗投递材料包：简历 + 匹配报告 + 话术 + 备注 */
export function exportApplyPackage(
  job: JobPost,
  resume: ResumeSection[],
  settings: AppSettings,
  reportMarkdown?: string,
) {
  const prefix = settings.export.filenamePrefix || 'job-helper'
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const safe = `${job.company}-${job.title}`.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40)
  const name = `${prefix}-package-${safe}-${stamp}.md`

  const md = [
    `# 投递材料包 · ${job.title}`,
    ``,
    `导出时间：${new Date().toLocaleString('zh-CN')}`,
    ``,
    `## 岗位信息`,
    `- 公司：${job.company}`,
    `- 城市：${job.city}`,
    `- 薪资：${job.salary}`,
    `- 匹配：${job.match}`,
    `- 状态：${job.applyStatus || 'new'}`,
    `- 链接：${job.link || '-'}`,
    job.note ? `- 备注：${job.note}` : '',
    ``,
    `## 打招呼话术`,
    ``,
    job.pitch || '（尚未生成，可在岗位详情点「生成话术」）',
    ``,
    `## 匹配说明`,
    job.reason || '',
    job.gaps?.length ? `\n### 短板\n${job.gaps.map((g) => `- ${g}`).join('\n')}` : '',
    job.missingKeywords?.length
      ? `\n### 建议关键词\n${job.missingKeywords.map((k) => `- ${k}`).join('\n')}`
      : '',
    ``,
    reportMarkdown ? `## 详细报告\n\n${reportMarkdown}\n` : '',
    `## 简历（当前版本）`,
    ``,
    resumeText(resume),
    ``,
  ]
    .filter(Boolean)
    .join('\n')

  downloadText(name, md, 'text/markdown;charset=utf-8')
  return name
}

export function exportMatchReport(reportMarkdown: string, settings: AppSettings, title = 'match-report') {
  const prefix = settings.export.filenamePrefix || 'job-helper'
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const name = `${prefix}-${title}-${stamp}.md`
  downloadText(name, reportMarkdown, 'text/markdown;charset=utf-8')
  return name
}

export function copyText(text: string) {
  return navigator.clipboard.writeText(text)
}
