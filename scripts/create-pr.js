#!/usr/bin/env node
// Usage:

// # Required: pass PR title as first argument
// node scripts/create-pr.js "feat(auth): add OAuth2 login"

// # With destination and description
// node scripts/create-pr.js "fix(api): resolve fetch issue" --destination=main --description="Fixes #123"

// # Create as draft (no reviewer notifications, cannot merge until marked ready)
// node scripts/create-pr.js "WIP: feature" --draft

// # Optional env (e.g. in pipeline or .env)
// export PR_DESTINATION_BRANCH=develop
// export PR_DESCRIPTION="Optional PR body text"
// export PR_DRAFT=1
// node scripts/create-pr.js "feat(ui): new button"

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
// read the environment variable from the file .env
const envPath = path.join(process.cwd(), '.env');
const env = fs.readFileSync(envPath, 'utf8');
const envVariables = env.split('\n').reduce((acc, line) => {
  const [key, value] = line.split('=');
  acc[key] = value;
  return acc;
}, {});

// Configuration (same env vars as gemini-code-review.js)
const BITBUCKET_WORKSPACE = envVariables.BITBUCKET_WORKSPACE || process.env.BITBUCKET_WORKSPACE;
const BITBUCKET_REPO_SLUG = envVariables.BITBUCKET_REPO_SLUG || process.env.BITBUCKET_REPO_SLUG;
const BITBUCKET_ACCESS_TOKEN = envVariables.BITBUCKET_ACCESS_TOKEN || process.env.BITBUCKET_ACCESS_TOKEN;
// For App passwords: Bitbucket username. For API tokens: Atlassian email. If set, Basic auth is used.
const BITBUCKET_USERNAME = envVariables.BITBUCKET_USERNAME || process.env.BITBUCKET_USERNAME;

/**
 * Get current branch name from git
 */
function getCurrentBranch() {
    try {
        return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
    } catch (error) {
        console.error('❌ Could not get current branch:', error.message);
        process.exit(1);
    }
}

/**
 * Create a pull request via Bitbucket REST API 2.0
 * @see https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/#api-repositories-workspace-repo-slug-pullrequests-post
 */
export async function createPullRequest({ title, description, sourceBranch, destinationBranch, draft }) {
    const body = JSON.stringify({
      title: title,
      source: { branch: { name: sourceBranch } },
      destination: { branch: { name: destinationBranch } },
      description: description,
      draft: draft
    });
    
    const options = {
      hostname: 'api.bitbucket.org',
      port: 443,
      path: '/2.0/repositories/<BITBUCKET_WORKSPACE>/<BITBUCKET_REPO_SLUG>/pullrequests',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + BITBUCKET_ACCESS_TOKEN,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('HTTP_STATUS:' + res.statusCode);
        console.log('RESPONSE_BODY:' + data);
      });
    });

    return new Promise((resolve, reject) => {
      req.on('response', (res) => {
        resolve(res);
      });
      req.on('error', (e) => { reject(e); });
    });
}

/**
 * Parse CLI args: [title] or --destination=develop, --description="..."
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        title: null,
        description: process.env.PR_DESCRIPTION || '',
        destinationBranch: process.env.PR_DESTINATION_BRANCH || 'develop',
        draft: process.env.PR_DRAFT === '1' || process.env.PR_DRAFT === 'true',
    };

    for (const arg of args) {
        if (arg === '--draft') {
            options.draft = true;
        } else if (arg.startsWith('--destination=')) {
            options.destinationBranch = arg.slice('--destination='.length).trim();
        } else if (arg.startsWith('--description=')) {
            options.description = arg.slice('--description='.length).trim();
        } else if (!arg.startsWith('--') && !options.title) {
            options.title = arg;
        }
    }

    return options;
}

/**
 * Main execution
 */
async function main() {
    console.log('🚀 Create Bitbucket Pull Request');
    console.log('');

    if (!BITBUCKET_ACCESS_TOKEN) {
        console.error('❌ BITBUCKET_ACCESS_TOKEN environment variable is not set');
        console.error('   Set it or add it to your Bitbucket repository variables');
        process.exit(1);
    }

    if (BITBUCKET_USERNAME) {
        console.log('🔐 Using Basic auth (BITBUCKET_USERNAME + token)');
    } else {
        console.log('🔐 Using Bearer token (OAuth). If you get 401, set BITBUCKET_USERNAME and use an App password.');
    }

    if (!BITBUCKET_WORKSPACE || !BITBUCKET_REPO_SLUG) {
        console.error('❌ BITBUCKET_WORKSPACE and BITBUCKET_REPO_SLUG must be set');
        console.error('   In pipelines they are set automatically; locally set them or use .env');
        process.exit(1);
    }

    const sourceBranch = getCurrentBranch();
    const { title, description, destinationBranch, draft } = parseArgs();

    if (!title || !title.trim()) {
        console.error('❌ PR title is required');
        console.error('');
        console.error('Usage:');
        console.error('  node scripts/create-pr.js "feat(scope): add feature"');
        console.error('  node scripts/create-pr.js "fix: bug description" [--destination=develop] [--description="Optional body"] [--draft]');
        console.error('');
        console.error('Environment (optional):');
        console.error('  PR_DESTINATION_BRANCH  default: develop');
        console.error('  PR_DESCRIPTION          default: empty');
        console.error('  PR_DRAFT                set to 1 or true to create as draft');
        process.exit(1);
    }

    if (sourceBranch === destinationBranch) {
        console.error(`❌ Source and destination branch are the same: ${sourceBranch}`);
        process.exit(1);
    }

    console.log(`📦 Repository: ${BITBUCKET_WORKSPACE}/${BITBUCKET_REPO_SLUG}`);
    console.log(`🌿 Source branch: ${sourceBranch}`);
    console.log(`🎯 Destination branch: ${destinationBranch}`);
    console.log(`📝 Title: ${title}`);
    if (draft) {
        console.log('📋 Draft: yes (reviewers not notified, cannot merge until marked ready)');
    }
    if (description) {
        console.log(`📄 Description: ${description.slice(0, 80)}${description.length > 80 ? '...' : ''}`);
    }
    console.log('');

    try {
        const pr = await createPullRequest({
            title: title.trim(),
            description: description || undefined,
            sourceBranch,
            destinationBranch,
            draft,
        });

        console.log(draft ? '✅ Draft pull request created successfully' : '✅ Pull request created successfully');
        console.log('');
        console.log(`   #${pr.id} ${pr.title}`);
        console.log(`   ${pr.links?.html?.href || `https://bitbucket.org/${BITBUCKET_WORKSPACE}/${BITBUCKET_REPO_SLUG}/pull-requests/${pr.id}`}`);
        console.log('');

        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to create pull request:', error.message);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
