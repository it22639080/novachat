import type { Request, Response } from "express";
import { inviteTeamMemberSchema, updateTeamMemberRoleSchema } from "@novachat/shared-types";
import { z } from "zod";
import { TeamService } from "../../application/services/team-service.js";
import { unauthorized } from "../../shared/errors/app-error.js";
import { sendSuccess } from "../../shared/http/api-response.js";

const teamService = new TeamService();
const memberIdParamSchema = z.string().uuid();

function requestMeta(req: Request) {
  return {
    ipAddress: req.ip,
    userAgent: req.header("user-agent")
  };
}

export class TeamController {
  async invite(req: Request, res: Response) {
    if (!req.user || !req.tenant) {
      throw unauthorized();
    }

    const member = await teamService.inviteMember(
      req.tenant.id,
      req.user.id,
      inviteTeamMemberSchema.parse(req.body),
      requestMeta(req)
    );
    sendSuccess(res, member, 201);
  }

  async members(req: Request, res: Response) {
    if (!req.tenant) {
      throw unauthorized();
    }

    sendSuccess(res, await teamService.listMembers(req.tenant.id));
  }

  async updateRole(req: Request, res: Response) {
    if (!req.user || !req.tenant) {
      throw unauthorized();
    }

    const member = await teamService.updateRole(
      req.tenant.id,
      req.user.id,
      memberIdParamSchema.parse(req.params.id),
      updateTeamMemberRoleSchema.parse(req.body),
      requestMeta(req)
    );
    sendSuccess(res, member);
  }

  async remove(req: Request, res: Response) {
    if (!req.user || !req.tenant) {
      throw unauthorized();
    }

    await teamService.removeMember(
      req.tenant.id,
      req.user.id,
      memberIdParamSchema.parse(req.params.id),
      requestMeta(req)
    );
    sendSuccess(res, { removed: true });
  }
}
