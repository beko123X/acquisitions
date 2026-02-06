import aj from "#config/arcject.js"
import logger from "#config/logger.js"
import {slidingWindow} from "@arcjet/node"

export const securityMiddleware = async(req, res,next)=>{
    try
    {
            const role = req.user?.role || 'guest';
            
            let limit;
            
            let message;
            
            switch (role) 
            {
                case 'admin':
                    limit = 20
                    message = 'Admin request limit exceeded ( 20 per minute). slow down'
                break;
                case 'user':
                    limit = 10
                    message = 'User request limit exceeded ( 10 per minute). slow down'
                break;
                case 'guest':
                    limit = 5
                    message = 'Guest request limit exceeded ( 5 per minute). slow down'
                break; 
            }
            
            const client = aj.withRule(
                slidingWindow({
                    mode:'LIVE', 
                    interval:'1m', 
                    max: limit, 
                    name: `${role}-rate-limit`}),
                    
            );
            
            const decision = await client.protect(req);
            
            // Debug: log decision in development
            if(process.env.NODE_ENV !== 'production') {
                console.log('Arcjet decision:', {
                    conclusion: decision.conclusion,
                    reason: decision.reason,
                    ip: req.ip
                });
            }
            
            if(decision.isDenied() && decision.reason.isBot()){
                logger.warn('Bot Request Blocked', 
                    {
                        ip:req.ip,
                        userAgent: req.get('User-Agent'),
                        path: req.path,
                        method: req.method
                    });
                
                return res.status(403).json({
                    error: 'Forbidden',
                    message: "Automated requests are not allowed"
                });
            }
            
            if(decision.isDenied() && decision.reason.isShield()){
                logger.warn('Shield Request Blocked', {
                    ip:req.ip, 
                    userAgent: req.get('User-Agent'),
                    path: req.path, 
                    method: req.method});
                return res.status(403).json({error: 'Forbidden', message: "Requests blocked by security policy"});
            }
            
            if(decision.isDenied() && decision.reason.isRateLimit()){
                logger.warn('Rate limit exceeded', {ip:req.ip, userAgent: req.get('User-Agent'), path: req.path, method: req.method});
                return res.status(429).json({error: 'Too Many Requests', message});
            }
            
            next();       
    }
    catch(e)
    {
        console.error('Arcjet Middleware error', e);
        res.status(500).send({error:'Internal Server Error', message: "Something went wrong with security middleware"});
    }
 }

export default securityMiddleware   