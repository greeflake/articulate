'use strict';
const Async = require('async');
const Boom = require('boom');
const Flat = require('../../../helpers/flat');
const Cast = require('../../../helpers/cast');
const RemoveBlankArray = require('../../../helpers/removeBlankArray');
const Status = require('../../../helpers/status.json');

const updateDataFunction = (redis, agentId, currentAgent, updateData, cb) => {

    const flatAgent = Flat(currentAgent);
    const flatUpdateData = Flat(updateData);
    Object.keys(flatUpdateData).forEach( (key) => {

        flatAgent[key] = flatUpdateData[key];
    });
    redis.hmset(`agent:${agentId}`, RemoveBlankArray(flatAgent), (err) => {

        if (err){
            const error = Boom.badImplementation('An error occurred updating the agent data.');
            return cb(error);
        }
        return cb(null, Flat.unflatten(flatAgent));
    });
};

module.exports = (request, reply) => {

    const agentId = request.params.id;
    const updateData = request.payload;
    let requiresRetrain = false;

    const server = request.server;
    const redis = server.app.redis;

    Async.waterfall([
        (cb) => {

            server.inject(`/agent/${agentId}`, (res) => {

                if (res.statusCode !== 200){
                    if (res.statusCode === 404){
                        const error = Boom.notFound('The specified agent doesn\'t exists');
                        return cb(error, null);
                    }
                    const error = Boom.create(res.statusCode, `An error occurred getting the data of the agent ${agentId}`);
                    return cb(error, null);
                }
                return cb(null, res.result);
            });
        },
        (currentAgent, cb) => {

            const requiresNameChanges = updateData.agentName && updateData.agentName !== currentAgent.agentName;
            requiresRetrain = (updateData.extraTrainingData !== undefined && updateData.extraTrainingData !== currentAgent.extraTrainingData) || (updateData.enableModelsPerDomain !== undefined && updateData.enableModelsPerDomain !== currentAgent.enableModelsPerDomain);
            if (requiresNameChanges){
                Async.waterfall([
                    (callback) => {

                        redis.zadd('agents', 'NX', agentId, updateData.agentName, (err, addResponse) => {

                            if (err){
                                const error = Boom.badImplementation(`An error occurred adding the name ${currentAgent.agentName} to the agents list of agents`);
                                return callback(error);
                            }
                            if (addResponse !== 0){
                                return callback(null);
                            }
                            const error = Boom.badRequest('An agent with this name already exists');
                            return callback(error, null);
                        });
                    },
                    (callback) => {

                        Async.parallel([
                            (callbackUpdateAgentDomains) => {

                                Async.waterfall([
                                    (callbackGetDomains) => {

                                        server.inject(`/agent/${agentId}/domain`, (res) => {

                                            if (res.statusCode !== 200){
                                                const error = Boom.create(res.statusCode, `An error occurred getting the sayings to update of the agent ${agentId}`);
                                                return callbackGetDomains(error, null);
                                            }
                                            return callbackGetDomains(null, res.result.domains);
                                        });
                                    },
                                    (domains, callbackUpdateEachDomain) => {

                                        Async.map(domains, (domain, callbackMapOfDomain) => {

                                            Async.parallel([
                                                (callbackUpdateDomain) => {

                                                    domain.agent = updateData.agentName;

                                                    requiresRetrain = true;
                                                    redis.hmset(`domain:${domain.id}`, RemoveBlankArray(Flat(domain)), (err, result) => {

                                                        if (err){
                                                            const error = Boom.badImplementation(`An error occurred updating the domain ${domain.id} with the new values of the agent`);
                                                            return callbackUpdateDomain(error, null);
                                                        }
                                                        return callbackUpdateDomain(null);
                                                    });
                                                },
                                                (callbackUpdateDomainSons) => {

                                                    Async.waterfall([
                                                        (callbackGetSayings) => {

                                                            server.inject(`/domain/${domain.id}/saying`, (res) => {

                                                                if (res.statusCode !== 200){
                                                                    const error = Boom.create(res.statusCode, `An error occurred getting the sayings to update of the domain ${domain.domainName}`);
                                                                    return callbackGetSayings(error, null);
                                                                }
                                                                return callbackGetSayings(null, res.result.sayings);
                                                            });
                                                        },
                                                        (sayings, callbackUpdateSayingAndScenario) => {

                                                            Async.map(sayings, (saying, callbackMapOfSaying) => {

                                                                requiresRetrain = true;
                                                                Async.parallel([
                                                                    (callbackUpdateSaying) => {

                                                                        saying.agent = updateData.agentName;

                                                                        redis.hmset(`saying:${saying.id}`, RemoveBlankArray(Flat(saying)), (err, result) => {

                                                                            if (err){
                                                                                const error = Boom.badImplementation(`An error occurred updating the saying ${saying.id} with the new values of the keyword`);
                                                                                return callbackUpdateSaying(error, null);
                                                                            }
                                                                            return callbackUpdateSaying(null);
                                                                        });
                                                                    },
                                                                    (callbackUpdateScenario) => {

                                                                        const updatedValues = {
                                                                            agent: updateData.agentName
                                                                        };
                                                                        redis.hmset(`scenario:${saying.id}`, updatedValues, (err, result) => {

                                                                            if (err){
                                                                                const error = Boom.badImplementation(`An error occurred updating the scenario of the saying ${saying.id} with the new values of the keyword`);
                                                                                return callbackUpdateScenario(error, null);
                                                                            }
                                                                            return callbackUpdateScenario(null);
                                                                        });
                                                                    }
                                                                ], (err, result) => {

                                                                    if (err){
                                                                        return callbackMapOfSaying(err);
                                                                    }
                                                                    return callbackMapOfSaying(null);
                                                                });
                                                            }, (err, result) => {

                                                                if (err){
                                                                    return callbackUpdateSayingAndScenario(err);
                                                                }
                                                                return callbackUpdateSayingAndScenario(null);
                                                            });
                                                        }
                                                    ], (err, result) => {

                                                        if (err){
                                                            return callbackUpdateDomainSons(err);
                                                        }
                                                        return callbackUpdateDomainSons(null);
                                                    });
                                                }
                                            ], (err, result) => {

                                                if (err){
                                                    return callbackMapOfDomain(err);
                                                }
                                                return callbackMapOfDomain(null);
                                            });
                                        }, (err, result) => {

                                            if (err){
                                                return callbackUpdateEachDomain(err);
                                            }
                                            return callbackUpdateEachDomain(null);
                                        });
                                    }
                                ], (err, result) => {

                                    if (err){
                                        return callbackUpdateAgentDomains(err);
                                    }
                                    return callbackUpdateAgentDomains(null);
                                });
                            },
                            (callbackUpdateAgentKeywords) => {

                                Async.waterfall([
                                    (callbackGetKeywords) => {

                                        server.inject(`/agent/${agentId}/keyword`, (res) => {

                                            if (res.statusCode !== 200){
                                                const error = Boom.create(res.statusCode, `An error occurred getting the keywords to update of the agent ${agentId}`);
                                                return callbackGetKeywords(error, null);
                                            }
                                            return callbackGetKeywords(null, res.result.keywords);
                                        });
                                    },
                                    (keywords, callbackUpdateEachKeyword) => {

                                        Async.map(keywords, (keyword, callbackMapOfKeyword) => {

                                            keyword.agent = updateData.agentName;

                                            requiresRetrain = true;
                                            redis.hmset(`keyword:${keyword.id}`, RemoveBlankArray(Flat(keyword)), (err, result) => {

                                                if (err){
                                                    const error = Boom.badImplementation(`An error occurred updating the keyword ${keyword.keywordName} with the new values of the agent`);
                                                    return callbackMapOfKeyword(error, null);
                                                }
                                                return callbackMapOfKeyword(null);
                                            });
                                        }, (err, result) => {

                                            if (err){
                                                return callbackUpdateEachKeyword(err);
                                            }
                                            return callbackUpdateEachKeyword(null);
                                        });
                                    }
                                ], (err, result) => {

                                    if (err){
                                        return callbackUpdateAgentKeywords(err);
                                    }
                                    return callbackUpdateAgentKeywords(null);
                                });
                            }
                        ], (err, result) => {

                            if (err){
                                return callback(err);
                            }
                            return callback(null);
                        });
                    },
                    (callback) => {

                        redis.zrem('agents', currentAgent.agentName, (err, removeResult) => {

                            if (err){
                                const error = Boom.badImplementation( `An error occurred removing the name ${currentAgent.agentName} from the agents list of agents`);
                                return callback(error);
                            }
                            return callback(null);
                        });
                    },
                    (callback) => {

                        updateDataFunction(redis, agentId, currentAgent, updateData, (err, result) => {

                            if (err){
                                const error = Boom.badImplementation('An error occurred adding the agent data.');
                                return callback(error);
                            }
                            return callback(null, result);
                        });
                    }
                ], (err, result) => {

                    if (err){
                        return cb(err);
                    }
                    return cb(null, result);
                });
            }
            else {
                updateDataFunction(redis, agentId, currentAgent, updateData, (err, result) => {

                    if (err){
                        const error = Boom.badImplementation('An error occurred adding the agent data.');
                        return cb(error);
                    }
                    return cb(null, result);
                });
            }
        }
    ], (err, result) => {

        if (err){
            return reply(err, null);
        }
        result = Cast(result, 'agent');
        if (requiresRetrain){
            const status = Status.outOfDate;
            result.status = status;
            redis.hmset(`agent:${agentId}`, { status }, (err) => {

                if (err){
                    const error = Boom.badImplementation('An error occurred updating the agent status.');
                    return reply(error);
                }
                server.publish(`/agent/${result.id}`, result);
                return reply(result);
            });
        }
        else {
            return reply(result);
        }
    });
};
