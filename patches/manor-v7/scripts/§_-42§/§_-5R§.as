package §_-42§
{
   import §_-0H§.Player;
   import §_-3i§.§_-Ep§;
   import §_-Iw§.§_-Yj§;
   import common.Session;
   import common.Settings;
   import common.§_-4Y§;
   import flash.events.EventDispatcher;
   import framework.net.NetHelper;
   import framework.net.§_-99§;
   import framework.net.vo.§_-P9§;
   import report.EventRecorder;

   public class §_-5R§ extends EventDispatcher
   {

      public static const §_-Ni§:String = "DataChanged";

      public static const §_-FU§:String = "DataLoading";

      public static const §_-x§:String = "DataFailed";

      public static const §_-D9§:String = "LogCleared";

      private var §_-97§:Array = [2,4,8];

      private var §_-G7§:Boolean;

      private var m_me:Boolean;

      private var §_-MM§:Boolean;

      private var m_data:Object;

      public function §_-5R§()
      {
         super();
         this.m_data = {};
         this.m_me = true;
         this.§_-G7§ = false;
         this.§_-MM§ = false;
      }

      public function sendChat(param1:String, param2:String, param3:int, param4:String, param5:String = "") : void
      {
         var _loc6_:String = "";
         if(this.m_me == true)
         {
            _loc6_ = Session.getInstance().host._userName;
         }
         else
         {
            _loc6_ = Session.getInstance().currentUser._userName;
         }
         var _loc7_:* = {
            "toId":param1,
            "msg":param4,
            "showId":param2,
            "isReply":param3,
            "tName":param5,
            "fName":_loc6_
         };
         NetHelper.sendRequest(§_-99§.§_-3l§,_loc7_,this.onChatMsgSent,null);
      }

      public function §_-O8§() : void
      {
         NetHelper.sendRequest(§_-99§.§_-5T§,null,this.onChatCleared,null);
      }

      private function onLogCleared(param1:§_-Ep§) : void
      {
         this.m_data["log"] = [];
         dispatchEvent(new §_-Yj§(§_-Ni§,{
            "index":"log",
            "data":this.m_data
         }));
      }

      public function reloadAll() : void
      {
         var _loc1_:Object = {"uId":Session.getInstance().hostId};
         _loc1_["ownerId"] = _loc1_["uId"];
         _loc1_["flag"] = 16;
         dispatchEvent(new §_-Yj§(§_-FU§,true));
         NetHelper.sendRequest(§_-99§.§_-6h§,_loc1_,this.onDataLoaded,this.onNetError);
      }

      private function onDataLoaded(param1:§_-Ep§) : void
      {
         var _loc5_:* = undefined;
         var _loc6_:* = undefined;
         var _loc7_:* = undefined;
         var _loc8_:* = undefined;
         var _loc9_:* = undefined;
         if(param1 == null || param1.result == null)
         {
            return;
         }
         var _loc2_:§_-P9§ = param1.result as §_-P9§;
         if(_loc2_ == null)
         {
            return;
         }
         var _loc3_:* = _loc2_.m_extra;
         var _loc4_:int = int(param1.body["cmdID"]);
         if(_loc4_ == §_-99§.CMD_GET_BILL_DATA)
         {
            this.§_-G7§ = true;
            _loc5_ = {"uin":Session.getInstance().host._uinLogin};
            NetHelper.sendRequest(§_-99§.CMD_GET_BILL_WS_DATA,_loc5_,this.onDataLoaded,this.onNetError);
            this.m_data["cost"] = _loc3_["cost"];
            EventRecorder.recordSueecssEvent(EventRecorder.HF_GET_BILL_DATA,null,"cgi_farm_exchange");
         }
         else if(_loc4_ == §_-99§.CMD_GET_BILL_WS_DATA)
         {
            this.§_-MM§ = true;
            if(this.m_data["cost"] == undefined || this.m_data["cost"] == null)
            {
               this.m_data["cost"] = _loc3_["cost"];
            }
            else if(_loc3_["cost"] is Array)
            {
               this.m_data["cost"] = this.m_data["cost"].concat(_loc3_["cost"]);
            }
            if(this.§_-G7§ == true && this.§_-MM§ == true)
            {
               if(this.m_data["cost"] is Array)
               {
                  this.m_data["cost"].sortOn("time",Array.DESCENDING);
               }
               dispatchEvent(new §_-Yj§(§_-Ni§,{
                  "index":"cost",
                  "data":this.m_data
               }));
            }
         }
         else if(_loc4_ == §_-99§.§_-25§)
         {
            if(_loc3_["ret"] == 0)
            {
               this.m_data["systemMsg"] = _loc3_["data"];
            }
            dispatchEvent(new §_-Yj§(§_-Ni§,{
               "index":"systemMsg",
               "data":this.m_data
            }));
            EventRecorder.recordSueecssEvent(EventRecorder.HF_GET_SYSTEM_MSG,null,"sysmsg_select");
         }
         else if(_loc4_ == §_-99§.§_-6h§ && param1.body["__body"]["flag"] == 3)
         {
            for(_loc6_ in _loc3_)
            {
               if(_loc6_ != "log")
               {
                  this.m_data[_loc6_] = _loc3_[_loc6_];
                  if(Boolean(_loc6_ == "user") && Boolean(_loc3_[_loc6_].hasOwnProperty("xystr")) && Settings.getInstance().mode == "")
                  {
                     Session.getInstance().currentUser.xystr = _loc3_["user"]["xystr"];
                  }
               }
            }
            this.§_-Sj§();
         }
         else if(_loc4_ == §_-99§.§_-6h§ && param1.body["__body"]["flag"] == 1)
         {
            for(_loc7_ in _loc3_)
            {
               this.m_data[_loc7_] = _loc3_[_loc7_];
               dispatchEvent(new §_-Yj§(§_-Ni§,{
                  "index":_loc7_,
                  "data":this.m_data
               }));
            }
            if(this.m_data["systemMsg"] != undefined)
            {
               return;
            }
            dispatchEvent(new §_-Yj§(§_-FU§,true));
            _loc8_ = {
               "uin":Session.getInstance().§_-9P§,
               "opuin":Session.getInstance().§_-9P§
            };
            _loc8_["appid"] = "353";
            _loc8_["msgnum"] = "300";
            NetHelper.sendRequest(§_-99§.§_-25§,_loc8_,this.onDataLoaded,this.onNetError);
         }
         else if(_loc4_ == §_-99§.§_-Fl§)
         {
            if(_loc3_["repertory"] is Array)
            {
               this.m_data["fish"] = _loc3_["repertory"];
            }
            dispatchEvent(new §_-Yj§(§_-Ni§,{
               "index":"fish",
               "data":this.m_data
            }));
         }
         else
         {
            for(_loc9_ in _loc3_)
            {
               this.m_data[_loc9_] = _loc3_[_loc9_];
               if(Boolean(_loc9_ == "user") && Boolean(_loc3_[_loc9_].hasOwnProperty("xystr")) && Settings.getInstance().mode == "")
               {
                  Session.getInstance().currentUser.xystr = _loc3_["user"]["xystr"];
               }
               dispatchEvent(new §_-Yj§(§_-Ni§,{
                  "index":_loc9_,
                  "data":this.m_data
               }));
            }
         }
      }

      public function §_-Sj§() : void
      {
         var _loc1_:* = null;
         if(this.m_me == true)
         {
            _loc1_ = Session.getInstance().host._uinLogin;
         }
         else
         {
            _loc1_ = Session.getInstance().currentUser.uin || Session.getInstance().currentUser.xystr;
         }
         var _loc2_:* = {
            "appid":353,
            "feedsnum":50,
            "isfeeds":1,
            "uin":_loc1_,
            "opuin":Session.getInstance().host._uinLogin
         };
         NetHelper.sendRequest(§_-99§.§_-Zt§,_loc2_,this.onLoadFeeds,this.onNetError);
      }

      public function §_-3-§() : void
      {
         var _loc1_:* = {
            "appid":353,
            "isfeeds":1,
            "uin":Session.getInstance().host._uinLogin
         };
         NetHelper.sendRequest(§_-99§.§_-Ip§,_loc1_,this.onLogCleared,null);
      }

      private function onChatCleared(param1:§_-Ep§) : void
      {
         if(param1 == null || param1.result == null)
         {
            return;
         }
         var _loc2_:§_-P9§ = param1.result as §_-P9§;
         if(_loc2_ == null)
         {
            return;
         }
         var _loc3_:Object = _loc2_.m_extra;
         if(_loc3_ != null && _loc3_["code"] == 1)
         {
            this.m_data["chat"] = [];
            dispatchEvent(new §_-Yj§(§_-Ni§,{
               "index":"chat",
               "data":this.m_data
            }));
         }
      }

      public function reset() : void
      {
         this.m_data = {};
         this.§_-G7§ = false;
         this.§_-MM§ = false;
      }

      public function get me() : Boolean
      {
         return this.m_me;
      }

      private function onChatMsgSent(param1:§_-Ep§) : void
      {
         if(param1 == null || param1.result == null)
         {
            return;
         }
         var _loc2_:§_-P9§ = param1.result as §_-P9§;
         if(_loc2_ == null)
         {
            return;
         }
         var _loc3_:Object = _loc2_.m_extra;
         this.m_data["chat"] = _loc3_["chat"];
         dispatchEvent(new §_-Yj§(§_-Ni§,{
            "index":"chat",
            "data":this.m_data
         }));
      }

      public function §_-Z8§(param1:int) : void
      {
         var _loc2_:Object = null;
         if(param1 >= 0 && param1 < 3)
         {
            if(param1 == 0 && this.m_data["log"] != undefined)
            {
               return;
            }
            if(param1 == 1 && this.m_data["chat"] != undefined)
            {
               return;
            }
            if(param1 == 2 && this.m_data["repertory"] != undefined)
            {
               return;
            }
            if(this.m_me == true)
            {
               _loc2_ = {"uId":Session.getInstance().hostId};
            }
            else
            {
               _loc2_ = {"uId":Session.getInstance().currentUser._uId};
            }
            _loc2_["ownerId"] = _loc2_["uId"];
            if(this.m_data["user"] != undefined)
            {
               _loc2_["flag"] = this.§_-97§[param1];
            }
            else
            {
               _loc2_["flag"] = this.§_-97§[param1] + 1;
            }
            dispatchEvent(new §_-Yj§(§_-FU§,true));
            if(_loc2_["flag"] == 2)
            {
               this.§_-Sj§();
            }
            else
            {
               NetHelper.sendRequest(§_-99§.§_-6h§,_loc2_,this.onDataLoaded,this.onNetError);
            }
         }
         else if(param1 == 3)
         {
            if(this.m_data["fish"] != undefined)
            {
               return;
            }
            if(this.m_me == true)
            {
               _loc2_ = {"uId":Session.getInstance().hostId};
            }
            else
            {
               _loc2_ = {"uId":Session.getInstance().currentUser._uId};
            }
            _loc2_["ownerId"] = _loc2_["uId"];
            dispatchEvent(new §_-Yj§(§_-FU§,true));
            NetHelper.sendRequest(§_-99§.§_-Fl§,_loc2_,this.onDataLoaded,this.onNetError);
         }
         else if(param1 == 4)
         {
            if(this.m_data["cost"] != undefined)
            {
               return;
            }
            dispatchEvent(new §_-Yj§(§_-FU§,true));
            this.§_-G7§ = false;
            this.§_-MM§ = false;
            NetHelper.sendRequest(§_-99§.CMD_GET_BILL_DATA,_loc2_,this.onDataLoaded,this.onNetError);
         }
         else if(param1 == 5)
         {
            if(this.m_data["user"] == undefined)
            {
               if(this.m_me == true)
               {
                  _loc2_ = {"uId":Session.getInstance().hostId};
               }
               else
               {
                  _loc2_ = {"uId":Session.getInstance().currentUser._uId};
               }
               _loc2_["ownerId"] = _loc2_["uId"];
               _loc2_["flag"] = 1;
               NetHelper.sendRequest(§_-99§.§_-6h§,_loc2_,this.onDataLoaded,this.onNetError);
            }
            else
            {
               if(this.m_data["systemMsg"] != undefined)
               {
                  return;
               }
               dispatchEvent(new §_-Yj§(§_-FU§,true));
               _loc2_ = {
                  "uin":Session.getInstance().§_-9P§,
                  "opuin":Session.getInstance().§_-9P§
               };
               _loc2_["appid"] = "353";
               _loc2_["msgnum"] = "300";
               NetHelper.sendRequest(§_-99§.§_-25§,_loc2_,this.onDataLoaded,this.onNetError);
            }
         }
      }

      public function set currentPlayer(param1:Player) : void
      {
         if(param1 == null || param1.me == true)
         {
            this.m_me = true;
         }
         else
         {
            this.m_me = false;
         }
      }

      private function onBillDataLoaded(param1:§_-Ep§) : void
      {
         if(param1 == null || param1.result == null)
         {
            return;
         }
         var _loc2_:§_-P9§ = param1.result as §_-P9§;
         if(_loc2_ == null)
         {
            return;
         }
         var _loc3_:Object = _loc2_.m_extra;
         if(_loc3_ != null && _loc3_["cost"] != undefined)
         {
            this.m_data["cost"] = _loc3_["cost"];
            dispatchEvent(new §_-Yj§(§_-Ni§,{
               "index":"cost",
               "data":this.m_data
            }));
         }
      }

      private function onLoadFeeds(param1:§_-Ep§) : void
      {
         var _loc4_:* = undefined;
         if(param1 == null || param1.result == null)
         {
            return;
         }
         var _loc2_:§_-P9§ = param1.result as §_-P9§;
         if(_loc2_ == null)
         {
            return;
         }
         var _loc3_:Object = _loc2_.m_extra;
         if(_loc3_["ecode"] == 0)
         {
            this.m_data["log"] = _loc3_["data"];
            for(_loc4_ in this.m_data)
            {
               dispatchEvent(new §_-Yj§(§_-Ni§,{
                  "index":_loc4_,
                  "data":this.m_data
               }));
            }
            EventRecorder.recordSueecssEvent(EventRecorder.HF_GET_FEEDS,null,"feeds_select");
         }
         else if(_loc3_["errmsg"] != undefined)
         {
            dispatchEvent(new §_-Yj§(§_-x§,{"error":_loc3_["errmsg"]}));
         }
      }

      private function onNetError(param1:§_-Ep§) : void
      {
         var _loc2_:String = §_-4Y§.§_-Kf§["请求超时，"] + "<a href=\'event:reload\'><u><font color=\'#ff6600\'>" + §_-4Y§.§_-Kf§["点击重试"] + "</font></u></a>";
         dispatchEvent(new §_-Yj§(§_-x§,{"error":_loc2_}));
         if(param1.body != null && param1.body["cmdID"] != undefined)
         {
            if(param1.body["cmdID"] as int == §_-99§.§_-25§)
            {
               EventRecorder.recordErrorEvent(EventRecorder.HF_GET_SYSTEM_MSG,null,EventRecorder.FAULT_ERROR,"sysmsg_select");
            }
            else if(param1.body["cmdID"] as int == §_-99§.§_-Zt§)
            {
               EventRecorder.recordErrorEvent(EventRecorder.HF_GET_FEEDS,null,EventRecorder.FAULT_ERROR,"feeds_select");
            }
            else if(param1.body["cmdID"] as int == §_-99§.CMD_GET_BILL_DATA)
            {
               EventRecorder.recordErrorEvent(EventRecorder.HF_GET_BILL_DATA,null,EventRecorder.FAULT_ERROR,"cgi_farm_exchange");
            }
         }
      }
   }
}
