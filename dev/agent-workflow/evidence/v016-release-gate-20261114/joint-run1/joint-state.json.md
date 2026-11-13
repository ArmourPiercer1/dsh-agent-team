```json
{
  "boot": 1,
  "phase": "create",
  "rootSessionId": "session-c1-smoke-root-2026-11-13T16-51-55-h0-r587c7d",
  "teamSession": {
    "rootSessionId": "session-c1-smoke-root-2026-11-13T16-51-55-h0-r587c7d",
    "blueprintId": "team.c1-anchor",
    "revision": "1",
    "contentHash": "sha256:3b93243c6b63ed28c7518f88caca30650af573cb08df51cc5d8f107ab30345df",
    "defaultWorkspace": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T16-51-55-h0-r587c7d/workspace",
    "createdAt": "2026-11-13T16:52:08.955Z",
    "generation": 2
  },
  "members": [
    {
      "instanceId": "inst-leader",
      "templateId": "leader",
      "label": "leader",
      "childSessionId": "undefined",
      "lifecycle": "undefined",
      "activityVersion": 1
    }
  ],
  "control": {
    "requests": [],
    "decisions": [],
    "consumptions": [],
    "abandonments": []
  },
  "activity": [],
  "pendingDeliveries": {
    "recovered": [],
    "skipped": []
  },
  "governance": {
    "overrides": [],
    "sessions": {
      "session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d": {
        "instanceId": "inst-leader",
        "model": {
          "current": {
            "provider": "deepseek-official",
            "model": "c1-smoke-model"
          },
          "assembled": {
            "provider": "deepseek-official",
            "model": "c1-smoke-model"
          },
          "selection": {
            "provider": "deepseek-official",
            "model": "c1-smoke-model"
          },
          "source": {
            "layer": "unspecified",
            "origin": "static",
            "recordId": null
          },
          "suppressed": [],
          "unavailable": false,
          "deniedBy": {
            "by": "team",
            "reason": "unspecifiedFailClosed"
          },
          "pendingNextBoundary": [],
          "explanation": "model: effective deny; team none(origin=static) deny (fail-closed: no team layer grants this cell); external exists=yes, hard=unspecified"
        },
        "mcp": {
          "servers": {}
        }
      },
      "session-c1-smoke-root-2026-11-13T16-51-55-h0-r587c7d": {
        "instanceId": "inst-leader",
        "model": {
          "current": {
            "provider": "deepseek-official",
            "model": "c1-smoke-model"
          },
          "assembled": {
            "provider": "deepseek-official",
            "model": "c1-smoke-model"
          },
          "selection": {
            "provider": "deepseek-official",
            "model": "c1-smoke-model"
          },
          "source": {
            "layer": "unspecified",
            "origin": "static",
            "recordId": null
          },
          "suppressed": [],
          "unavailable": false,
          "deniedBy": {
            "by": "team",
            "reason": "unspecifiedFailClosed"
          },
          "pendingNextBoundary": [],
          "explanation": "model: effective deny; team none(origin=static) deny (fail-closed: no team layer grants this cell); external exists=yes, hard=unspecified"
        },
        "mcp": {
          "servers": {}
        }
      },
      "session-team-child-04e3fdbdbbecad8786050178778e7adf": {
        "instanceId": "inst-143ehib1pse1",
        "model": {
          "current": {
            "provider": "deepseek-official",
            "model": "c1-smoke-model"
          },
          "assembled": {
            "provider": "deepseek-official",
            "model": "c1-smoke-model"
          },
          "selection": {
            "provider": "deepseek-official",
            "model": "c1-smoke-model"
          },
          "source": {
            "layer": "unspecified",
            "origin": "static",
            "recordId": null
          },
          "suppressed": [],
          "unavailable": false,
          "deniedBy": {
            "by": "team",
            "reason": "unspecifiedFailClosed"
          },
          "pendingNextBoundary": [],
          "explanation": "model: effective deny; team none(origin=static) deny (fail-closed: no team layer grants this cell); external exists=yes, hard=unspecified"
        },
        "mcp": {
          "servers": {}
        }
      },
      "session-team-child-d16c0a36766631837d378f19207e0e13": {
        "instanceId": "inst-1jom8i51fdrb",
        "model": {
          "current": {
            "provider": "deepseek-official",
            "model": "c1-smoke-model"
          },
          "assembled": {
            "provider": "deepseek-official",
            "model": "c1-smoke-model"
          },
          "selection": {
            "provider": "deepseek-official",
            "model": "c1-smoke-model"
          },
          "source": {
            "layer": "unspecified",
            "origin": "static",
            "recordId": null
          },
          "suppressed": [],
          "unavailable": false,
          "deniedBy": {
            "by": "team",
            "reason": "unspecifiedFailClosed"
          },
          "pendingNextBoundary": [],
          "explanation": "model: effective deny; team none(origin=static) deny (fail-closed: no team layer grants this cell); external exists=yes, hard=unspecified"
        },
        "mcp": {
          "servers": {}
        }
      }
    }
  },
  "observations": [
    "a5p1-guard: dispatcher-preparing agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d to=PREPARING",
    "a5p1-guard: guard-installed agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d scope=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d",
    "a5p1-guard: dispatcher-seam-armed agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d seam=tools/pre-execute armed=1 required=5",
    "a5p1-guard: dispatcher-seam-armed agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d seam=tools/post-execute armed=2 required=5",
    "a5p1-guard: dispatcher-seam-armed agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d seam=tools/result armed=3 required=5",
    "a5p1-guard: dispatcher-seam-armed agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d seam=tools/execute armed=4 required=5",
    "a5p1-guard: dispatcher-seam-armed agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d seam=tools.guard armed=5 required=5",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_list_members\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_list_members\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_list_members\",\"team_list_templates\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_list_members\",\"team_list_templates\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_inspect_config\",\"team_list_members\",\"team_list_templates\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_inspect_config\",\"team_list_members\",\"team_list_templates\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_create_member\",\"team_inspect_config\",\"team_list_members\",\"team_list_templates\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_create_member\",\"team_inspect_config\",\"team_list_members\",\"team_list_templates\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_create_member\",\"team_delegate\",\"team_inspect_config\",\"team_list_members\",\"team_list_templates\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_create_member\",\"team_delegate\",\"team_inspect_config\",\"team_list_members\",\"team_list_templates\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_collect\",\"team_create_member\",\"team_delegate\",\"team_inspect_config\",\"team_list_members\",\"team_list_templates\",\"todo_wri… removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_collect\",\"team_create_member\",\"team_delegate\",\"team_inspect_config\",\"team_list_members\",\"team_list_templates\",\"todo_wri… note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_collect\",\"team_create_member\",\"team_delegate\",\"team_inspect_config\",\"team_list_members\",\"team_list_templates\",\"team_req… removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_collect\",\"team_create_member\",\"team_delegate\",\"team_inspect_config\",\"team_list_members\",\"team_list_templates\",\"team_req… note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_collect\",\"team_create_member\",\"team_delegate\",\"team_inspect_config\",\"team_list_members\",\"team_list_templates\",\"team_req… removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_collect\",\"team_create_member\",\"team_delegate\",\"team_inspect_config\",\"team_list_members\",\"team_list_templates\",\"team_req… note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_collect\",\"team_create_member\",\"team_delegate\",\"team_inspect_config\",\"team_list_members\",\"team_list_pending_control\",\"te… removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_collect\",\"team_create_member\",\"team_delegate\",\"team_inspect_config\",\"team_list_members\",\"team_list_pending_control\",\"te… note=these names are refused at dispatch by the Guard",
    "a5-admission: event=production-admission-note",
    "a5-admission: event=production-admission-note",
    "a5-admission: event=production-admission-constructed templateDefault=ask notes=2 realmId=c1-plane-realm-2026-11-13T16-51-55-h0-r587c7d templateId=leader",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_collect\",\"team_create_member\",\"team_delegate\",\"team_grep\",\"team_inspect_config\",\"team_list_members\",\"team_list_pending_… removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_collect\",\"team_create_member\",\"team_delegate\",\"team_grep\",\"team_inspect_config\",\"team_list_members\",\"team_list_pending_… note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_collect\",\"team_create_member\",\"team_delegate\",\"team_glob\",\"team_grep\",\"team_inspect_config\",\"team_list_members\",\"team_l… removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_collect\",\"team_create_member\",\"team_delegate\",\"team_glob\",\"team_grep\",\"team_inspect_config\",\"team_list_members\",\"team_l… note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_collect\",\"team_create_member\",\"team_delegate\",\"team_glob\",\"team_grep\",\"team_inspect_config\",\"team_list_members\",\"team_l… removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_collect\",\"team_create_member\",\"team_delegate\",\"team_glob\",\"team_grep\",\"team_inspect_config\",\"team_list_members\",\"team_l… note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"pwsh\",\"read\",\"read_image\",\"team_collect\",\"team_create_member\",\"team_delegate\",\"team_glob\",\"team_grep\",\"team_inspect_config\",\"team_list_members\",… removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d denied=[\"bash\",\"edit\",\"pwsh\",\"read\",\"read_image\",\"team_collect\",\"team_create_member\",\"team_delegate\",\"team_glob\",\"team_grep\",\"team_inspect_config\",\"team_list_members\",… note=these names are refused at dispatch by the Guard",
    "a5-plane: placed [team_grep,team_glob,bash,pwsh]",
    "a5g7: placement-feed rows=[team_grep,team_glob,bash,pwsh] realm=c1-plane-realm-2026-11-13T16-51-55-h0-r587c7d",
    "a5ptc: census-boot root=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d",
    "a5ptc: census-boot root=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d selectedRunner=/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py enforcement=landlock-launcher pinned (sha256:f418831915c624fb)",
    "a5ptc: member-registered root=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d",
    "alpha2-perm: coverage PASS safe-unmanaged tool 'todo_write' on session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d (source-reviewed closed registry)",
    "a5p1-guard: binding-feed-verified agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d tool=team_grep note=the live scoped read resolved exactly the Definition this assembly placed; the provider record is now the identity every call is compared against",
    "a5p1-guard: binding-feed-verified agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d tool=team_glob note=the live scoped read resolved exactly the Definition this assembly placed; the provider record is now the identity every call is compared against",
    "a5p1-guard: binding-feed-verified agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d tool=bash note=the live scoped read resolved exactly the Definition this assembly placed; the provider record is now the identity every call is compared against",
    "a5p1-guard: binding-feed-verified agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d tool=pwsh note=the live scoped read resolved exactly the Definition this assembly placed; the provider record is now the identity every call is compared against",
    "a5p1-guard: dispatcher-bind-inherited agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d verified=0 surface=18",
    "a5p1-guard: published-surface-unverified agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d note=observed on the publish surface, not attributable to a trusted native source and not bound by this assembly: governed and refused at dispatch",
    "a5p1-guard: surface-inherited agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d verified=0",
    "a5p1-guard: dispatcher-active agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d to=ACTIVE",
    "a5p1-guard: agent-published agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d surface=18 masked=11 seams=[\"tools.guard\",\"tools/execute\",\"tools/post-execute\",\"tools/pre-execute\",\"tools/result\"] scope=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d",
    "alpha2-artifact-grant: shell-result-observer installed",
    "a5p1-guard: dispatcher-call-begin agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d tool=team_create_member callId=p6t6-call-1 inFlight=1",
    "a5p1-guard: dispatcher-preparing agent=session-team-child-04e3fdbdbbecad8786050178778e7adf to=PREPARING",
    "a5p1-guard: guard-installed agent=session-team-child-04e3fdbdbbecad8786050178778e7adf scope=session-team-child-04e3fdbdbbecad8786050178778e7adf",
    "a5p1-guard: dispatcher-seam-armed agent=session-team-child-04e3fdbdbbecad8786050178778e7adf seam=tools/pre-execute armed=1 required=5",
    "a5p1-guard: dispatcher-seam-armed agent=session-team-child-04e3fdbdbbecad8786050178778e7adf seam=tools/post-execute armed=2 required=5",
    "a5p1-guard: dispatcher-seam-armed agent=session-team-child-04e3fdbdbbecad8786050178778e7adf seam=tools/result armed=3 required=5",
    "a5p1-guard: dispatcher-seam-armed agent=session-team-child-04e3fdbdbbecad8786050178778e7adf seam=tools/execute armed=4 required=5",
    "a5p1-guard: dispatcher-seam-armed agent=session-team-child-04e3fdbdbbecad8786050178778e7adf seam=tools.guard armed=5 required=5",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-04e3fdbdbbecad8786050178778e7adf state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-team-child-04e3fdbdbbecad8786050178778e7adf denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-04e3fdbdbbecad8786050178778e7adf state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-team-child-04e3fdbdbbecad8786050178778e7adf denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-04e3fdbdbbecad8786050178778e7adf state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-team-child-04e3fdbdbbecad8786050178778e7adf denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-04e3fdbdbbecad8786050178778e7adf state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-team-child-04e3fdbdbbecad8786050178778e7adf denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-04e3fdbdbbecad8786050178778e7adf state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-team-child-04e3fdbdbbecad8786050178778e7adf denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-04e3fdbdbbecad8786050178778e7adf state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-team-child-04e3fdbdbbecad8786050178778e7adf denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-04e3fdbdbbecad8786050178778e7adf state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_resolve_control\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-team-child-04e3fdbdbbecad8786050178778e7adf denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_resolve_control\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-04e3fdbdbbecad8786050178778e7adf state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_list_pending_control\",\"team_resolve_control\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-team-child-04e3fdbdbbecad8786050178778e7adf denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_list_pending_control\",\"team_resolve_control\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5-admission: event=production-admission-note",
    "a5-admission: event=production-admission-constructed templateDefault=deny notes=1 realmId=c1-plane-realm-2026-11-13T16-51-55-h0-r587c7d templateId=officer",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-04e3fdbdbbecad8786050178778e7adf state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_grep\",\"team_list_pending_control\",\"team_resolve_control\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-team-child-04e3fdbdbbecad8786050178778e7adf denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_grep\",\"team_list_pending_control\",\"team_resolve_control\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-04e3fdbdbbecad8786050178778e7adf state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_glob\",\"team_grep\",\"team_list_pending_control\",\"team_resolve_control\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-team-child-04e3fdbdbbecad8786050178778e7adf denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_glob\",\"team_grep\",\"team_list_pending_control\",\"team_resolve_control\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-04e3fdbdbbecad8786050178778e7adf state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"pwsh\",\"read\",\"read_image\",\"team_glob\",\"team_grep\",\"team_list_pending_control\",\"team_resolve_control\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-team-child-04e3fdbdbbecad8786050178778e7adf denied=[\"bash\",\"edit\",\"pwsh\",\"read\",\"read_image\",\"team_glob\",\"team_grep\",\"team_list_pending_control\",\"team_resolve_control\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5-plane: placed [team_grep,team_glob,pwsh]",
    "a5nb: native admission published for session-team-child-04e3fdbdbbecad8786050178778e7adf",
    "a5g7: placement-feed rows=[team_grep,team_glob,pwsh] realm=c1-plane-realm-2026-11-13T16-51-55-h0-r587c7d",
    "a5ptc: member-registered root=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d",
    "a5sf-bind: realm-forwarded names declared=[bash,read,write,edit,read_image] realm=c1-plane-realm-2026-11-13T16-51-55-h0-r587c7d",
    "alpha2-perm: coverage PASS safe-unmanaged tool 'todo_write' on session-team-child-04e3fdbdbbecad8786050178778e7adf (source-reviewed closed registry)",
    "a5p1-guard: binding-feed-verified agent=session-team-child-04e3fdbdbbecad8786050178778e7adf tool=team_grep note=the live scoped read resolved exactly the Definition this assembly placed; the provider record is now the identity every call is compared against",
    "a5p1-guard: binding-feed-verified agent=session-team-child-04e3fdbdbbecad8786050178778e7adf tool=team_glob note=the live scoped read resolved exactly the Definition this assembly placed; the provider record is now the identity every call is compared against",
    "a5p1-guard: binding-feed-verified agent=session-team-child-04e3fdbdbbecad8786050178778e7adf tool=pwsh note=the live scoped read resolved exactly the Definition this assembly placed; the provider record is now the identity every call is compared against",
    "a5p1-guard: dispatcher-bind-inherited agent=session-team-child-04e3fdbdbbecad8786050178778e7adf verified=0 surface=11",
    "a5p1-guard: published-surface-unverified agent=session-team-child-04e3fdbdbbecad8786050178778e7adf note=observed on the publish surface, not attributable to a trusted native source and not bound by this assembly: governed and refused at dispatch",
    "a5p1-guard: surface-inherited agent=session-team-child-04e3fdbdbbecad8786050178778e7adf verified=0",
    "a5p1-guard: dispatcher-active agent=session-team-child-04e3fdbdbbecad8786050178778e7adf to=ACTIVE",
    "a5p1-guard: agent-published agent=session-team-child-04e3fdbdbbecad8786050178778e7adf surface=11 masked=11 seams=[\"tools.guard\",\"tools/execute\",\"tools/post-execute\",\"tools/pre-execute\",\"tools/result\"] scope=session-team-child-04e3fdbdbbecad8786050178778e7adf",
    "alpha2-artifact-grant: shell-result-observer installed",
    "a5p1-guard: dispatcher-result-observed agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d callId=p6t6-call-1 inFlight=1 note=a result exists; the Body return is not yet proven, so the lease stays",
    "a5p1-guard: dispatcher-call-end agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d tool=team_create_member callId=p6t6-call-1 inFlight=0",
    "a5p1-guard: dispatcher-call-begin agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d tool=team_create_member callId=p6t6-call-2 inFlight=1",
    "a5p1-guard: dispatcher-preparing agent=session-team-child-d16c0a36766631837d378f19207e0e13 to=PREPARING",
    "a5p1-guard: guard-installed agent=session-team-child-d16c0a36766631837d378f19207e0e13 scope=session-team-child-d16c0a36766631837d378f19207e0e13",
    "a5p1-guard: dispatcher-seam-armed agent=session-team-child-d16c0a36766631837d378f19207e0e13 seam=tools/pre-execute armed=1 required=5",
    "a5p1-guard: dispatcher-seam-armed agent=session-team-child-d16c0a36766631837d378f19207e0e13 seam=tools/post-execute armed=2 required=5",
    "a5p1-guard: dispatcher-seam-armed agent=session-team-child-d16c0a36766631837d378f19207e0e13 seam=tools/result armed=3 required=5",
    "a5p1-guard: dispatcher-seam-armed agent=session-team-child-d16c0a36766631837d378f19207e0e13 seam=tools/execute armed=4 required=5",
    "a5p1-guard: dispatcher-seam-armed agent=session-team-child-d16c0a36766631837d378f19207e0e13 seam=tools.guard armed=5 required=5",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-04e3fdbdbbecad8786050178778e7adf state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-d16c0a36766631837d378f19207e0e13 state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-team-child-d16c0a36766631837d378f19207e0e13 denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-04e3fdbdbbecad8786050178778e7adf state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-d16c0a36766631837d378f19207e0e13 state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-team-child-d16c0a36766631837d378f19207e0e13 denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-04e3fdbdbbecad8786050178778e7adf state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-d16c0a36766631837d378f19207e0e13 state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-team-child-d16c0a36766631837d378f19207e0e13 denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-04e3fdbdbbecad8786050178778e7adf state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-d16c0a36766631837d378f19207e0e13 state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-team-child-d16c0a36766631837d378f19207e0e13 denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-04e3fdbdbbecad8786050178778e7adf state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-d16c0a36766631837d378f19207e0e13 state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-team-child-d16c0a36766631837d378f19207e0e13 denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-04e3fdbdbbecad8786050178778e7adf state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-d16c0a36766631837d378f19207e0e13 state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-team-child-d16c0a36766631837d378f19207e0e13 denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5-admission: event=production-admission-note",
    "a5-admission: event=production-admission-note",
    "a5-admission: event=production-admission-note",
    "a5-admission: event=production-admission-note",
    "a5-admission: event=production-admission-constructed templateDefault=ask notes=4 realmId=c1-plane-realm-2026-11-13T16-51-55-h0-r587c7d templateId=worker",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-04e3fdbdbbecad8786050178778e7adf state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-d16c0a36766631837d378f19207e0e13 state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_grep\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-team-child-d16c0a36766631837d378f19207e0e13 denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_grep\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-04e3fdbdbbecad8786050178778e7adf state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-d16c0a36766631837d378f19207e0e13 state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_glob\",\"team_grep\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-team-child-d16c0a36766631837d378f19207e0e13 denied=[\"bash\",\"edit\",\"read\",\"read_image\",\"team_glob\",\"team_grep\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-04e3fdbdbbecad8786050178778e7adf state=ACTIVE drifted=[] added=[] removed=[]",
    "a5p1-guard: dispatcher-surface-revalidated agent=session-team-child-d16c0a36766631837d378f19207e0e13 state=PREPARING drifted=[] added=[\"bash\",\"edit\",\"pwsh\",\"read\",\"read_image\",\"team_glob\",\"team_grep\",\"todo_write\",\"write\"] removed=[]",
    "a5p1-guard: tools-change-unbound-names agent=session-team-child-d16c0a36766631837d378f19207e0e13 denied=[\"bash\",\"edit\",\"pwsh\",\"read\",\"read_image\",\"team_glob\",\"team_grep\",\"todo_write\",\"write\"] note=these names are refused at dispatch by the Guard",
    "a5-plane: placed [team_grep,team_glob,pwsh]",
    "a5nb: native admission published for session-team-child-d16c0a36766631837d378f19207e0e13",
    "a5g7: placement-feed rows=[team_grep,team_glob,pwsh] realm=c1-plane-realm-2026-11-13T16-51-55-h0-r587c7d",
    "a5ptc: member-registered root=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d",
    "a5sf-bind: realm-forwarded names declared=[bash,read,write,edit,read_image] realm=c1-plane-realm-2026-11-13T16-51-55-h0-r587c7d",
    "alpha2-perm: coverage PASS safe-unmanaged tool 'todo_write' on session-team-child-d16c0a36766631837d378f19207e0e13 (source-reviewed closed registry)",
    "a5p1-guard: binding-feed-verified agent=session-team-child-d16c0a36766631837d378f19207e0e13 tool=team_grep note=the live scoped read resolved exactly the Definition this assembly placed; the provider record is now the identity every call is compared against",
    "a5p1-guard: binding-feed-verified agent=session-team-child-d16c0a36766631837d378f19207e0e13 tool=team_glob note=the live scoped read resolved exactly the Definition this assembly placed; the provider record is now the identity every call is compared against",
    "a5p1-guard: binding-feed-verified agent=session-team-child-d16c0a36766631837d378f19207e0e13 tool=pwsh note=the live scoped read resolved exactly the Definition this assembly placed; the provider record is now the identity every call is compared against",
    "a5p1-guard: dispatcher-bind-inherited agent=session-team-child-d16c0a36766631837d378f19207e0e13 verified=0 surface=9",
    "a5p1-guard: published-surface-unverified agent=session-team-child-d16c0a36766631837d378f19207e0e13 note=observed on the publish surface, not attributable to a trusted native source and not bound by this assembly: governed and refused at dispatch",
    "a5p1-guard: surface-inherited agent=session-team-child-d16c0a36766631837d378f19207e0e13 verified=0",
    "a5p1-guard: dispatcher-active agent=session-team-child-d16c0a36766631837d378f19207e0e13 to=ACTIVE",
    "a5p1-guard: agent-published agent=session-team-child-d16c0a36766631837d378f19207e0e13 surface=9 masked=11 seams=[\"tools.guard\",\"tools/execute\",\"tools/post-execute\",\"tools/pre-execute\",\"tools/result\"] scope=session-team-child-d16c0a36766631837d378f19207e0e13",
    "alpha2-artifact-grant: shell-result-observer installed",
    "a5p1-guard: dispatcher-result-observed agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d callId=p6t6-call-2 inFlight=1 note=a result exists; the Body return is not yet proven, so the lease stays",
    "a5p1-guard: dispatcher-call-end agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d tool=team_create_member callId=p6t6-call-2 inFlight=0",
    "a5p1-guard: dispatcher-call-begin agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d tool=team_delegate callId=p6t6-call-3 inFlight=1",
    "a5p1-guard: dispatcher-result-observed agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d callId=p6t6-call-3 inFlight=1 note=a result exists; the Body return is not yet proven, so the lease stays",
    "a5p1-guard: dispatcher-call-end agent=session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d tool=team_delegate callId=p6t6-call-3 inFlight=0",
    "a5p1-guard: dispatcher-call-begin agent=session-team-child-d16c0a36766631837d378f19207e0e13 tool=bash callId=call-c1-ntbhfm2y inFlight=1",
    "alpha2-perm: {\"stage\":\"canonicalized\",\"callId\":\"call-c1-ntbhfm2y\",\"tool\":\"bash\",\"resourceKind\":\"tool\",\"resourceDisplay\":\"bash\",\"fingerprint\":\"sha256:435731b20528082cc368de03f08ab122a81d27c94b53f653296cd5b080d84a41\"}",
    "alpha2-perm: {\"stage\":\"decision\",\"callId\":\"call-c1-ntbhfm2y\",\"decision\":\"ask\",\"provenance\":{\"source\":\"rule\",\"effect\":\"ask\",\"lane\":\"ask\",\"ruleIndex\":0}}",
    "alpha2-perm: {\"stage\":\"dynamic-decision\",\"callId\":\"call-c1-ntbhfm2y\",\"tool\":\"bash\",\"plane\":\"exec\",\"decision\":\"ask\",\"winningLayer\":\"template\",\"overlayGeneration\":null,\"source\":\"rule\",\"staticDecision\":\"ask\",\"explanation\":\"exec fingerprint sha256:435731b20528082cc368de03f08ab122a81d27c94b53f653296cd5b080d84a41 answered ask from the layer\"}",
    "alpha2-perm: {\"stage\":\"request-created\",\"callId\":\"call-c1-ntbhfm2y\",\"requestId\":\"ctrl-10bcyw908dtd2k12cfdq71gm\",\"kind\":\"leader-approval\",\"correlation\":\"call-c1-ntbhfm2y\"}",
    "a5p1-guard: dispatcher-call-begin agent=session-team-child-04e3fdbdbbecad8786050178778e7adf tool=team_list_pending_control callId=call-c1-dw4g9a17 inFlight=1",
    "a5p1-guard: dispatcher-result-observed agent=session-team-child-04e3fdbdbbecad8786050178778e7adf callId=call-c1-dw4g9a17 inFlight=1 note=a result exists; the Body return is not yet proven, so the lease stays",
    "a5p1-guard: dispatcher-call-end agent=session-team-child-04e3fdbdbbecad8786050178778e7adf tool=team_list_pending_control callId=call-c1-dw4g9a17 inFlight=0",
    "a5p1-guard: dispatcher-call-begin agent=session-team-child-04e3fdbdbbecad8786050178778e7adf tool=team_resolve_control callId=call-c1-pupa4psd inFlight=1",
    "a5p1-guard: dispatcher-result-observed agent=session-team-child-04e3fdbdbbecad8786050178778e7adf callId=call-c1-pupa4psd inFlight=1 note=a result exists; the Body return is not yet proven, so the lease stays",
    "a5p1-guard: dispatcher-call-end agent=session-team-child-04e3fdbdbbecad8786050178778e7adf tool=team_resolve_control callId=call-c1-pupa4psd inFlight=0",
    "alpha2-perm: {\"stage\":\"decision-arrived\",\"callId\":\"call-c1-ntbhfm2y\",\"requestId\":\"ctrl-10bcyw908dtd2k12cfdq71gm\",\"decision\":\"allow\",\"decisionSequence\":8}",
    "alpha2-perm: {\"stage\":\"guard-verdict\",\"callId\":\"call-c1-ntbhfm2y\",\"allowed\":true,\"requestId\":\"ctrl-10bcyw908dtd2k12cfdq71gm\",\"decisionSequence\":8}",
    "alpha2-perm: {\"stage\":\"terminal-outcome\",\"callId\":\"call-c1-ntbhfm2y\",\"outcome\":\"execution-succeeded\",\"requestId\":\"ctrl-10bcyw908dtd2k12cfdq71gm\"}",
    "a5-admission: event=admission-requires-approval callId=team-inst-1jom8i51fdrb-native-bash:hexec:nb-1794588730957-1839089064-1 approvalCaseId=tadm:session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d:inst-1jom8i51fdrb:sha256:77b14744144ea4ac367ea6695ffebcdc03c603c4b25650ffc239c08559048b56:g0 requiredAuthority=leader",
    "a5-pa-bridge: request-created ",
    "a5p1-guard: dispatcher-call-begin agent=session-team-child-04e3fdbdbbecad8786050178778e7adf tool=team_list_pending_control callId=call-c1-sdr4cjir inFlight=1",
    "a5p1-guard: dispatcher-result-observed agent=session-team-child-04e3fdbdbbecad8786050178778e7adf callId=call-c1-sdr4cjir inFlight=1 note=a result exists; the Body return is not yet proven, so the lease stays",
    "a5p1-guard: dispatcher-call-end agent=session-team-child-04e3fdbdbbecad8786050178778e7adf tool=team_list_pending_control callId=call-c1-sdr4cjir inFlight=0",
    "a5p1-guard: dispatcher-call-begin agent=session-team-child-04e3fdbdbbecad8786050178778e7adf tool=team_resolve_control callId=call-c1-mhaxrbfr inFlight=1",
    "a5-pa-verifier: resolve/covered ",
    "a5p1-guard: dispatcher-result-observed agent=session-team-child-04e3fdbdbbecad8786050178778e7adf callId=call-c1-mhaxrbfr inFlight=1 note=a result exists; the Body return is not yet proven, so the lease stays",
    "a5p1-guard: dispatcher-call-end agent=session-team-child-04e3fdbdbbecad8786050178778e7adf tool=team_resolve_control callId=call-c1-mhaxrbfr inFlight=0",
    "a5-pa-bridge: decision-arrived ",
    "a5-admission: event=admission-grant-minted callId=team-inst-1jom8i51fdrb-native-bash:hexec:nb-1794588730957-1839089064-1 grantId=grant:1fa1e9b07af503c369bd0d5f2f90982e effects=1",
    "a5-admission: event=admission-approved-grant-issued callId=team-inst-1jom8i51fdrb-native-bash:hexec:nb-1794588730957-1839089064-1 grantId=grant:1fa1e9b07af503c369bd0d5f2f90982e caseId=tadm:session-c1-smoke-a6-2026-11-13T16-51-55-h0-r587c7d:inst-1jom8i51fdrb:sha256:77b14744144ea4ac367ea6695ffebcdc03c603c4b25650ffc239c08559048b56:g0",
    "a5-pa-bridge: grant-minted ",
    "a5-pa-verifier: guard/covered ",
    "a5-pa-bridge: guard-consumed ",
    "a5p1-guard: dispatcher-result-observed agent=session-team-child-d16c0a36766631837d378f19207e0e13 callId=call-c1-ntbhfm2y inFlight=1 note=a result exists; the Body return is not yet proven, so the lease stays",
    "a5p1-guard: dispatcher-call-end agent=session-team-child-d16c0a36766631837d378f19207e0e13 tool=bash callId=call-c1-ntbhfm2y inFlight=0",
    "a5p1-guard: dispatcher-call-begin agent=session-team-child-d16c0a36766631837d378f19207e0e13 tool=write callId=call-c1-yds5feqw inFlight=1",
    "alpha2-perm: {\"stage\":\"canonicalized\",\"callId\":\"call-c1-yds5feqw\",\"tool\":\"write\",\"resourceKind\":\"file\",\"resourceDisplay\":\"/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T16-51-55-h0-r587c7d/workspace/pd42-inside-2026-11-13T16-51-55-h0-r587c7d.txt\",\"fingerprint\":\"sha256:a67018e79333096e0045496173cb173b2c62eead988372b796537b0f830f7d71\"}",
    "alpha2-perm: {\"stage\":\"decision\",\"callId\":\"call-c1-yds5feqw\",\"decision\":\"allow\",\"provenance\":{\"source\":\"rule\",\"effect\":\"allow\",\"lane\":\"allow\",\"ruleIndex\":0}}",
    "alpha2-perm: {\"stage\":\"dynamic-decision\",\"callId\":\"call-c1-yds5feqw\",\"tool\":\"write\",\"plane\":\"file\",\"decision\":\"allow\",\"winningLayer\":\"template\",\"overlayGeneration\":null,\"source\":\"rule\",\"staticDecision\":\"allow\",\"explanation\":\"write[/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T16-51-55-h0-r587c7d/workspace/pd42-inside-2026-11-13T16-51-55-h0-r587c7d.txt]: effective allow; decided by template(worker) allow[lane index 0, source 0]; layers (highest first): template=matched; overridden lower: none\"}",
    "a5p1-guard: dispatcher-result-observed agent=session-team-child-d16c0a36766631837d378f19207e0e13 callId=call-c1-yds5feqw inFlight=1 note=a result exists; the Body return is not yet proven, so the lease stays",
    "a5p1-guard: dispatcher-call-end agent=session-team-child-d16c0a36766631837d378f19207e0e13 tool=write callId=call-c1-yds5feqw inFlight=0",
    "alpha2-perm: {\"stage\":\"execution-result\",\"callId\":\"call-c1-ntbhfm2y\",\"requestId\":\"ctrl-10bcyw908dtd2k12cfdq71gm\",\"outcome\":\"succeeded\",\"recorded\":true,\"via\":\"terminal-result\"}",
    "a5p1-guard: dispatcher-call-begin agent=session-team-child-d16c0a36766631837d378f19207e0e13 tool=write callId=call-c1-46jtk1sm inFlight=1",
    "alpha2-perm: {\"stage\":\"canonicalized\",\"callId\":\"call-c1-46jtk1sm\",\"tool\":\"write\",\"resourceKind\":\"file\",\"resourceDisplay\":\"/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T16-51-55-h0-r587c7d/pd42-outside-2026-11-13T16-51-55-h0-r587c7d.txt\",\"fingerprint\":\"sha256:0eb9a6951bddef01442d57004e1688fd21564c9851d943dad60e9c643e717eab\"}",
    "alpha2-perm: {\"stage\":\"decision\",\"callId\":\"call-c1-46jtk1sm\",\"decision\":\"allow\",\"provenance\":{\"source\":\"rule\",\"effect\":\"allow\",\"lane\":\"allow\",\"ruleIndex\":0}}",
    "alpha2-perm: {\"stage\":\"dynamic-decision\",\"callId\":\"call-c1-46jtk1sm\",\"tool\":\"write\",\"plane\":\"file\",\"decision\":\"allow\",\"winningLayer\":\"template\",\"overlayGeneration\":null,\"source\":\"rule\",\"staticDecision\":\"allow\",\"explanation\":\"write[/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T16-51-55-h0-r587c7d/pd42-outside-2026-11-13T16-51-55-h0-r587c7d.txt]: effective allow; decided by template(worker) allow[lane index 0, source 0]; layers (highest first): template=matched; overridden lower: none\"}",
    "a5p1-guard: dispatcher-result-observed agent=session-team-child-d16c0a36766631837d378f19207e0e13 callId=call-c1-46jtk1sm inFlight=1 note=a result exists; the Body return is not yet proven, so the lease stays",
    "a5p1-guard: dispatcher-call-end agent=session-team-child-d16c0a36766631837d378f19207e0e13 tool=write callId=call-c1-46jtk1sm inFlight=0",
    "a5p1-guard: dispatcher-call-begin agent=session-team-child-d16c0a36766631837d378f19207e0e13 tool=read callId=call-c1-1uytgrwk inFlight=1",
    "alpha2-perm: {\"stage\":\"canonicalized\",\"callId\":\"call-c1-1uytgrwk\",\"tool\":\"read\",\"resourceKind\":\"file\",\"resourceDisplay\":\"/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T16-51-55-h0-r587c7d/pd42-outside-2026-11-13T16-51-55-h0-r587c7d.txt\",\"fingerprint\":\"sha256:c146f91623a7aab82ba3086e2ee7e0f8cf8726046941da5f44847dd8bc6c9d02\"}",
    "alpha2-perm: {\"stage\":\"decision\",\"callId\":\"call-c1-1uytgrwk\",\"decision\":\"allow\",\"provenance\":{\"source\":\"rule\",\"effect\":\"allow\",\"lane\":\"allow\",\"ruleIndex\":1}}",
    "alpha2-perm: {\"stage\":\"dynamic-decision\",\"callId\":\"call-c1-1uytgrwk\",\"tool\":\"read\",\"plane\":\"file\",\"decision\":\"allow\",\"winningLayer\":\"template\",\"overlayGeneration\":null,\"source\":\"rule\",\"staticDecision\":\"allow\",\"explanation\":\"read[/home/armourpiercer/projects/dsh-agent-team/.worktrees/v016-release-gate/tests/homes/c1-smoke-2026-11-13T16-51-55-h0-r587c7d/pd42-outside-2026-11-13T16-51-55-h0-r587c7d.txt]: effective allow; decided by template(worker) allow[lane index 1, source 1]; layers (highest first): template=matched; overridden lower: none\"}",
    "a5p1-guard: kernel-pre-body-table-refusal agent=session-team-child-d16c0a36766631837d378f19207e0e13 tool=read callId=call-c1-1uytgrwk note=the kernel approval table no longer backs this definition (revoked, rebound, or moved source); the call is refused before its Body (U6 PR2, FIX-K K1)",
    "a5p1-guard: dispatcher-call-refused agent=session-team-child-d16c0a36766631837d378f19207e0e13 tool=read state=ACTIVE callId=call-c1-1uytgrwk inFlight=0"
  ]
}
```
