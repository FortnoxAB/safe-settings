/* eslint-disable no-undef */
class Octokit {}
const Settings = require('../../../lib/settings')
const yaml = require('js-yaml')
// jest.mock('../../../lib/settings', () => {
//   const OriginalSettings = jest.requireActual('../../../lib/settings')
//   //const orginalSettingsInstance = new OriginalSettings(false, stubContext, mockRepo, config, mockRef, mockSubOrg)
//   return OriginalSettings
// })

describe('Settings Tests', () => {
  let stubContext
  let mockRepo
  let stubConfig
  let mockRef
  let mockSubOrg
  let subOrgConfig

  function createSettings(config) {
    const settings = new Settings(false, stubContext, mockRepo, config, mockRef, mockSubOrg)
    return settings;
  }

  beforeEach(() => {
    const mockOctokit = jest.mocked(Octokit)
    const content = Buffer.from(`
suborgrepos:
- new-repo
#- test*
#- secret*

suborgteams:
- core

suborgproperties:
- EDP: true
- do_no_delete: true

teams:
  - name: core
    permission: bypass
  - name: docss
    permission: pull
  - name: docs
    permission: pull

validator:
  pattern: '[a-zA-Z0-9_-]+_[a-zA-Z0-9_-]+.*'

repository:
  # A comma-separated list of topics to set on the repository
  topics:
  - frontend
     `).toString('base64');
    mockOctokit.rest = {
      repos: {
        getContent: jest.fn().mockResolvedValue({ data: { content } })
      }
    }

    mockOctokit.request = {
      endpoint: jest.fn().mockReturnValue({})
    }

    mockOctokit.paginate = jest.fn().mockResolvedValue([])

    stubContext = {
      payload: {
        installation: {
          id: 123
        }
      },
      octokit: mockOctokit,
      log: {
        debug: jest.fn((msg) => {
          console.log(msg)
        }),
        info: jest.fn((msg) => {
          console.log(msg)
        }),
        error: jest.fn((msg) => {
          console.log(msg)
        })
      }
    }



    mockRepo = { owner: 'test', repo: 'test-repo' }
    mockRef = 'main'
    mockSubOrg = 'frontend'
  })

  describe('restrictedRepos', () => {
    describe('restrictedRepos not defined', () => {
      beforeEach(() => {
        stubConfig = {
          restrictedRepos: {
          }
        }
      })

      it('Allow repositories being configured', () => {
        settings = createSettings(stubConfig)
        expect(settings.isRestricted('my-repo')).toEqual(false)
        expect(settings.isRestricted('another-repo')).toEqual(false)
      })

      it('Do not allow default excluded repositories being configured', () => {
        settings = createSettings(stubConfig)
        expect(settings.isRestricted('.github')).toEqual(false)
        expect(settings.isRestricted('safe-settings')).toEqual(false)
        expect(settings.isRestricted('admin')).toEqual(false)
      })
    })

    describe('restrictedRepos.exclude defined', () => {
      beforeEach(() => {
        stubConfig = {
          restrictedRepos: {
            exclude: ['foo', '*-test', 'personal-*']
          }
        }
      })

      it('Skipping excluded repository from being configured', () => {
        settings = createSettings(stubConfig)
        expect(settings.isRestricted('foo')).toEqual(true)
      })

      it('Skipping excluded repositories matching regex in restrictedRepos.exclude', () => {
        settings = createSettings(stubConfig)
        expect(settings.isRestricted('my-repo-test')).toEqual(true)
        expect(settings.isRestricted('personal-repo')).toEqual(true)
      })

      it('Allowing repositories not matching regex in restrictedRepos.exclude', () => {
        settings = createSettings(stubConfig)
        expect(settings.isRestricted('my-repo-test-data')).toEqual(false)
        expect(settings.isRestricted('personalization-repo')).toEqual(false)
      })
    })

    describe('restrictedRepos.include defined', () => {
      beforeEach(() => {
        stubConfig = {
          restrictedRepos: {
            include: ['foo', '*-test', 'personal-*']
          }
        }
      })

      it('Allowing repository from being configured', () => {
        settings = createSettings(stubConfig)
        expect(settings.isRestricted('foo')).toEqual(false)
      })

      it('Allowing repositories matching regex in restrictedRepos.include', () => {
        settings = createSettings(stubConfig)
        expect(settings.isRestricted('my-repo-test')).toEqual(false)
        expect(settings.isRestricted('personal-repo')).toEqual(false)
      })

      it('Skipping repositories not matching regex in restrictedRepos.include', () => {
        settings = createSettings(stubConfig)
        expect(settings.isRestricted('my-repo-test-data')).toEqual(true)
        expect(settings.isRestricted('personalization-repo')).toEqual(true)
      })
    })

    describe('restrictedRepos not defined', () => {
      it('Throws TypeError if restrictedRepos not defined', () => {
        stubConfig = {}
        settings = createSettings(stubConfig)
        expect(() => settings.isRestricted('my-repo')).toThrow('Cannot read properties of undefined (reading \'include\')')
      })

      it('Throws TypeError if restrictedRepos is null', () => {
        stubConfig = {
          restrictedRepos: null
        }
        settings = createSettings(stubConfig)
        expect(() => settings.isRestricted('my-repo')).toThrow('Cannot read properties of null (reading \'include\')')
      })

      it('Allowing all repositories if restrictedRepos is empty', () => {
        stubConfig = {
          restrictedRepos: []
        }
        settings = createSettings(stubConfig)
        expect(settings.isRestricted('my-repo')).toEqual(false)
      })
    })
  }) // restrictedRepos

  describe('getRepoOverrideConfig', () => {
    describe('repository defined in a file using the .yaml extension', () => {
      beforeEach(() => {
        stubConfig = {
          repoConfigs: {
            'repository.yaml': { repository: { name: 'repository', config: 'config1' } }
          }
        }
      })

      it('Picks up a repository defined in file using the .yaml extension', () => {
        settings = createSettings(stubConfig)
        settings.repoConfigs = stubConfig.repoConfigs
        const repoConfig = settings.getRepoOverrideConfig('repository')

        expect(typeof repoConfig).toBe('object')
        expect(repoConfig).not.toBeNull()
        expect(Object.keys(repoConfig).length).toBeGreaterThan(0)
      })
    })

    describe('repository defined in a file using the .yml extension', () => {
      beforeEach(() => {
        stubConfig = {
          repoConfigs: {
            'repository.yml': { repository: { name: 'repository', config: 'config1' } }
          }
        }
      })

      it('Picks up a repository defined in file using the .yml extension', () => {
        settings = createSettings(stubConfig)
        settings.repoConfigs = stubConfig.repoConfigs
        const repoConfig = settings.getRepoOverrideConfig('repository')

        expect(typeof repoConfig).toBe('object')
        expect(repoConfig).not.toBeNull()
        expect(Object.keys(repoConfig).length).toBeGreaterThan(0)
      })
    })
  }) // repoOverrideConfig
  describe('loadConfigs', () => {
    describe('load suborg configs', () => {
      beforeEach(() => {
        stubConfig = {
          restrictedRepos: {
          }
        }
        subOrgConfig = yaml.load(`
          suborgrepos:
          - new-repo

          suborgproperties:
          - EDP: true
          - do_no_delete: true

          teams:
            - name: core
              permission: bypass
            - name: docss
              permission: pull
            - name: docs
              permission: pull

          validator:
            pattern: '[a-zA-Z0-9_-]+_[a-zA-Z0-9_-]+.*'

          repository:
            # A comma-separated list of topics to set on the repository
            topics:
            - frontend

          `)

      })

      it("Should load configMap for suborgs'", async () => {
        //mockSubOrg = jest.fn().mockReturnValue(['suborg1', 'suborg2'])
        mockSubOrg = undefined
        settings = createSettings(stubConfig)
        jest.spyOn(settings, 'loadConfigMap').mockImplementation(() => [{ name: "frontend", path: ".github/suborgs/frontend.yml" }])
        jest.spyOn(settings, 'loadYaml').mockImplementation(() => subOrgConfig)
        jest.spyOn(settings, 'getReposForTeam').mockImplementation(() => [{ name: 'repo-test' }])
        jest.spyOn(settings, 'getSubOrgRepositories').mockImplementation(() => [{ repository_name: 'repo-for-property' }])

        const subOrgConfigs = await settings.getSubOrgConfigs()
        expect(settings.loadConfigMap).toHaveBeenCalledTimes(1)

        // Get own properties of subOrgConfigs
        const ownProperties = Object.getOwnPropertyNames(subOrgConfigs);
        expect(ownProperties.length).toEqual(3)
      })

      it("Should throw an error when a repo is found in multiple suborgs configs'", async () => {
        //mockSubOrg = jest.fn().mockReturnValue(['suborg1', 'suborg2'])
        mockSubOrg = undefined
        settings = createSettings(stubConfig)
        jest.spyOn(settings, 'loadConfigMap').mockImplementation(() => [{ name: "frontend", path: ".github/suborgs/frontend.yml" }, { name: "backend", path: ".github/suborgs/backend.yml" }])
        jest.spyOn(settings, 'loadYaml').mockImplementation(() => subOrgConfig)
        jest.spyOn(settings, 'getReposForTeam').mockImplementation(() => [{ name: 'repo-test' }])
        jest.spyOn(settings, 'getSubOrgRepositories').mockImplementation(() => [{ repository_name: 'repo-for-property' }])

        expect(async () => await settings.getSubOrgConfigs()).rejects.toThrow('Multiple suborg configs for new-repo in .github/suborgs/backend.yml and .github/suborgs/frontend.yml')
        // try {
        //   await settings.getSubOrgConfigs()
        // } catch (e) {
        //   console.log(e)
        // }
      })
    })
  }) // loadConfigs

  describe('loadYaml', () => {
    let settings;

    beforeEach(() => {
      Settings.fileCache = {};
      stubContext = {
        octokit: {
          rest: {
            repos: {
              getContent: jest.fn()
            }
          },
          request: jest.fn(),
          paginate: jest.fn()
        },
        log: {
          debug: jest.fn(),
          info: jest.fn(),
          error: jest.fn()
        },
        payload: {
          installation: {
            id: 123
          }
        }
      };
      settings = createSettings({});
    });

    it('should return parsed YAML content when file is fetched successfully', async () => {
      // Given
      const filePath = 'path/to/file.yml';
      const content = Buffer.from('key: value').toString('base64');
      jest.spyOn(settings.github.rest.repos, 'getContent').mockResolvedValue({
        data: { content },
        headers: { etag: 'etag123' }
      });

      // When
      const result = await settings.loadYaml(filePath);

      // Then
      expect(result).toEqual({ key: 'value' });
      expect(Settings.fileCache[`${mockRepo.owner}/${filePath}`]).toEqual({
        etag: 'etag123',
        data: { content }
      });
    });

    it('should return cached content when file has not changed (304 response)', async () => {
      // Given
      const filePath = 'path/to/file.yml';
      const content = Buffer.from('key: value').toString('base64');
      Settings.fileCache[`${mockRepo.owner}/${filePath}`] = { etag: 'etag123', data: { content } };
      jest.spyOn(settings.github.rest.repos, 'getContent').mockRejectedValue({ status: 304 });

      // When
      const result = await settings.loadYaml(filePath);

      // Then
      expect(result).toEqual({ key: 'value' });
      expect(settings.github.rest.repos.getContent).toHaveBeenCalledWith(
        expect.objectContaining({ headers: { 'If-None-Match': 'etag123' } })
      );
    });

    it('should not return cached content when the cache is for another org', async () => {
      // Given
      const filePath = 'path/to/file.yml';
      const content = Buffer.from('key: value').toString('base64');
      const wrongContent = Buffer.from('wrong: content').toString('base64');
      Settings.fileCache['another-org/path/to/file.yml'] = { etag: 'etag123', data: { wrongContent } };
      jest.spyOn(settings.github.rest.repos, 'getContent').mockResolvedValue({
        data: { content },
        headers: { etag: 'etag123' }
      });

      // When
      const result = await settings.loadYaml(filePath);

      // Then
      expect(result).toEqual({ key: 'value' });
    })

    it('should return null when the file path is a folder', async () => {
      // Given
      const filePath = 'path/to/folder';
      jest.spyOn(settings.github.rest.repos, 'getContent').mockResolvedValue({
        data: []
      });

      // When
      const result = await settings.loadYaml(filePath);

      // Then
      expect(result).toBeNull();
    });

    it('should return null when the file is a symlink or submodule', async () => {
      // Given
      const filePath = 'path/to/symlink';
      jest.spyOn(settings.github.rest.repos, 'getContent').mockResolvedValue({
        data: { content: null }
      });

      // When
      const result = await settings.loadYaml(filePath);

      // Then
      expect(result).toBeUndefined();
    });

    it('should handle 404 errors gracefully and return null', async () => {
      // Given
      const filePath = 'path/to/nonexistent.yml';
      jest.spyOn(settings.github.rest.repos, 'getContent').mockRejectedValue({ status: 404 });

      // When
      const result = await settings.loadYaml(filePath);

      // Then
      expect(result).toBeNull();
    });

    it('should throw an error for non-404 exceptions when not in nop mode', async () => {
      // Given
      const filePath = 'path/to/error.yml';
      jest.spyOn(settings.github.rest.repos, 'getContent').mockRejectedValue(new Error('Unexpected error'));

      // When / Then
      await expect(settings.loadYaml(filePath)).rejects.toThrow('Unexpected error');
    });

    it('should log and append NopCommand for non-404 exceptions in nop mode', async () => {
      // Given
      const filePath = 'path/to/error.yml';
      settings.nop = true;
      jest.spyOn(settings.github.rest.repos, 'getContent').mockRejectedValue(new Error('Unexpected error'));
      jest.spyOn(settings, 'appendToResults');

      // When
      const result = await settings.loadYaml(filePath);

      // Then
      expect(result).toBeUndefined();
      expect(settings.appendToResults).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'ERROR',
            action: expect.objectContaining({
              msg: expect.stringContaining('Unexpected error')
            })
          })
        ])
      );
    });
  });

  describe('handleResults - PR comment', () => {
    let settings

    function changeResult (repo) {
      return {
        type: 'INFO',
        plugin: 'Repository',
        repo,
        action: { additions: {}, deletions: {}, modifications: { name: repo } }
      }
    }

    beforeEach(() => {
      stubContext.payload.check_run = {
        id: 1,
        html_url: 'https://github.com/test/test-repo/runs/1',
        check_suite: { pull_requests: [{ number: 42 }] }
      }
      stubContext.payload.repository = { owner: { login: 'test' }, name: 'test-repo' }

      stubContext.octokit.rest.issues = {
        listComments: jest.fn(),
        createComment: jest.fn().mockResolvedValue({})
      }
      stubContext.octokit.rest.checks = {
        update: jest.fn().mockResolvedValue({})
      }
      stubContext.octokit.graphql = jest.fn().mockResolvedValue({})
      stubContext.octokit.paginate = jest.fn().mockResolvedValue([])

      settings = createSettings({})
      settings.nop = true
    })

    it('creates a new comment with the heading, summary line, check-run link and checkbox when none exists', async () => {
      settings.results = [changeResult('test-repo')]

      await settings.handleResults()

      expect(stubContext.octokit.graphql).not.toHaveBeenCalled()
      expect(stubContext.octokit.rest.issues.createComment).toHaveBeenCalledTimes(1)
      const body = stubContext.octokit.rest.issues.createComment.mock.calls[0][0].body
      expect(body).toContain('#### :robot: Safe-Settings config changes detected:')
      expect(body).toContain('**Plugins affected:** Repository')
      expect(body).toContain('https://github.com/test/test-repo/runs/1')
      expect(body).toContain('- [ ] I have reviewed the changes and verified that they are intended.')
    })

    it('minimizes the most recent matching comment and creates a fresh one', async () => {
      stubContext.octokit.paginate.mockResolvedValue([
        { id: 100, node_id: 'node-100', body: 'unrelated comment' },
        { id: 200, node_id: 'node-200', body: '#### :robot: Safe-Settings config changes detected:\nold diff' }
      ])
      settings.results = [changeResult('test-repo')]

      await settings.handleResults()

      expect(stubContext.octokit.graphql).toHaveBeenCalledTimes(1)
      expect(stubContext.octokit.graphql.mock.calls[0][1]).toEqual({ id: 'node-200' })
      expect(stubContext.octokit.rest.issues.createComment).toHaveBeenCalledTimes(1)
    })

    it('only minimizes the last matching comment when several exist from repeat runs', async () => {
      stubContext.octokit.paginate.mockResolvedValue([
        { id: 1, node_id: 'node-1', body: '#### :robot: Safe-Settings config changes detected:\nfirst' },
        { id: 2, node_id: 'node-2', body: '#### :robot: Safe-Settings config changes detected:\nsecond' }
      ])
      settings.results = [changeResult('test-repo')]

      await settings.handleResults()

      expect(stubContext.octokit.graphql).toHaveBeenCalledTimes(1)
      expect(stubContext.octokit.graphql.mock.calls[0][1]).toEqual({ id: 'node-2' })
    })

    it('creates a comment without minimizing when existing comments do not match the heading', async () => {
      stubContext.octokit.paginate.mockResolvedValue([
        { id: 1, node_id: 'node-1', body: 'just a regular review comment' }
      ])
      settings.results = [changeResult('test-repo')]

      await settings.handleResults()

      expect(stubContext.octokit.graphql).not.toHaveBeenCalled()
      expect(stubContext.octokit.rest.issues.createComment).toHaveBeenCalledTimes(1)
    })

    it('keeps the checkbox and truncation marker when the diff is huge', async () => {
      settings.results = Array.from({ length: 500 }, (_, i) => ({
        type: 'INFO',
        plugin: 'Repository',
        repo: `test-repo-${i}`,
        action: { additions: {}, deletions: {}, modifications: { name: `test-repo-${i}`, description: 'x'.repeat(200) } }
      }))

      await settings.handleResults()

      const body = stubContext.octokit.rest.issues.createComment.mock.calls[0][0].body
      expect(body).toContain('... (too many changes to report)')
      expect(body).toContain('- [ ] I have reviewed the changes and verified that they are intended.')
    })

    it('sets conclusion to action_required when there are unverified changes', async () => {
      settings.results = [changeResult('test-repo')]

      await settings.handleResults()

      expect(stubContext.octokit.rest.checks.update).toHaveBeenCalledWith(
        expect.objectContaining({ conclusion: 'action_required' })
      )
    })

    it('sets conclusion to success when there are no changes', async () => {
      settings.results = [{
        type: 'INFO', plugin: 'Repository', repo: 'test-repo', action: { additions: null, deletions: null, modifications: null }
      }]

      await settings.handleResults()

      expect(stubContext.octokit.rest.checks.update).toHaveBeenCalledWith(
        expect.objectContaining({ conclusion: 'success' })
      )
    })

    it('sets conclusion to failure when there is an error, regardless of changes', async () => {
      settings.results = [{
        type: 'ERROR', plugin: 'Repository', repo: 'test-repo', action: { msg: 'boom', additions: null, deletions: null, modifications: null }
      }]

      await settings.handleResults()

      expect(stubContext.octokit.rest.checks.update).toHaveBeenCalledWith(
        expect.objectContaining({ conclusion: 'failure' })
      )
    })
  })
}) // Settings Tests
