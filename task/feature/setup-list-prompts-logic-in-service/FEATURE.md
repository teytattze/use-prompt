# Goal

Expose `GET /api/v1/prompt` to return a HTTP envelope with a list of prompt

# Background

The current service only expose `POST /api/v1/prompt` endpoint

# Problem

The web is not able to fetch the prompts

# Solution

Create a new `GET /api/v1/prompt` endpoint under prompt module

# Proposal

- Check the `POST /api/v1/prompt` endpoint and its implementation, and use that as an example.
- Setup unit test for the use-case layer

# Acceptance Criteria

- Client is able to call `GET /api/v1/prompt`
- Unit test is written for the use-case
