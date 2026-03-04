import type { MethodGroup } from '@shared/gateway-protocol'
import { giteaClient } from '@main/services/gitea-client'

export const giteaMethods: MethodGroup = {
  namespace: 'gitea',
  methods: {
    repos: async (p) => giteaClient.listRepos(Number(p.page || 1), Number(p.limit || 50)),

    repoDetail: async (p) => giteaClient.getRepo(String(p.owner), String(p.repo)),

    issues: async (p) => giteaClient.listIssues(
      String(p.owner), String(p.repo),
      String(p.state || 'open'), Number(p.page || 1), Number(p.limit || 50)
    ),

    issueDetail: async (p) => giteaClient.getIssue(String(p.owner), String(p.repo), Number(p.index)),

    createIssue: async (p) => giteaClient.createIssue(
      String(p.owner), String(p.repo),
      { title: String(p.title), body: p.body ? String(p.body) : undefined }
    ),

    pulls: async (p) => giteaClient.listPulls(
      String(p.owner), String(p.repo),
      String(p.state || 'open'), Number(p.page || 1), Number(p.limit || 50)
    ),

    pullDetail: async (p) => giteaClient.getPull(String(p.owner), String(p.repo), Number(p.index)),

    pullFiles: async (p) => giteaClient.getPullFiles(String(p.owner), String(p.repo), Number(p.index)),

    mergePull: async (p) => giteaClient.mergePull(
      String(p.owner), String(p.repo), Number(p.index),
      String(p.method || 'merge')
    )
  }
}
