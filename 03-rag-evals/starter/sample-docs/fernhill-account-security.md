# Fernhill Cloud Account Security

Fernhill Cloud is a fictional file-sync service for small teams, used as sample data for this project. This page explains how accounts and data are protected.

## Two-factor authentication

Any member can turn on two-factor authentication from Profile, then Security. Admins on the Team and Business plans can require it for everyone in the team.

## Single sign-on

Single sign-on with Google Workspace, Microsoft Entra ID or Okta is available on the Business plan only.

## Sessions

Signed-in sessions on the web expire after 12 hours without activity. Admins can sign a member out of every device from the Members page.

## Audit log

Business plans keep an audit log of sign-ins, shares and deletions for one year. Team plans keep it for 90 days. Starter has no audit log.

## Where data is stored

When a team is created, the admin chooses whether its files are stored in the EU (Frankfurt) or the US (Virginia). The region cannot be changed later.

## Encryption

Files are encrypted in transit with TLS 1.3 and at rest with AES-256.
