package §_-Gt§
{
   import common.misc.Utils;
   import flash.display.MovieClip;
   import flash.display.SimpleButton;
   import flash.display.Stage;
   import flash.events.Event;
   import flash.events.MouseEvent;
   import flash.geom.Point;
   import flash.utils.clearTimeout;
   import flash.utils.setTimeout;
   import wild.com.Shell.command.CmdAPI;
   
   public class Tool_Wild extends §_-0z§
   {
      
      private static var _canReleaseNum:int;
      
      private var §_-5y§:uint;
      
      private var §_-1H§:MovieClip;
      
      private var §_-U1§:int;
      
      private var §_-YK§:MovieClip;
      
      private var §_-IW§:Stage;
      
      private var §_-6s§:*;
      
      public function Tool_Wild()
      {
         super();
         this.§_-6s§ = Utils.getMaterial("Wild_Animal_Icon") as SimpleButton;
         this.§_-6s§.x = 8;
         this.bindWildClick();
         this.§_-1H§ = Utils.getMaterial("WildTaskBg") as MovieClip;
         this.§_-1H§.x = 9;
         addChild(this.§_-1H§);
         addChild(this.§_-6s§);
         CmdAPI.getInstance().addEventListener("canReleaseNum",this.getCanReleaseNum);
         addEventListener(Event.REMOVED_FROM_STAGE,this.onRemoved,false,0,true);
         this.§_-5y§ = 0;
      }
      
      private function onRemoved(param1:Event) : void
      {
         this.removeText();
      }
      
      private function onTextTipCountdown(param1:Event) : void
      {
         if(this.§_-YK§ != null && this.§_-YK§.currentFrame == this.§_-YK§.totalFrames)
         {
            this.removeText();
         }
      }
      
      public function removeText() : void
      {
         if(this.§_-5y§ > 0)
         {
            clearTimeout(this.§_-5y§);
            this.§_-5y§ = 0;
         }
         if(this.§_-YK§ != null)
         {
            this.§_-YK§.stop();
            this.§_-IW§.removeChild(this.§_-YK§);
            this.§_-YK§ = null;
         }
         this.§_-U1§ = 0;
      }
      
      private function showText(param1:String, param2:int = 0) : void
      {
         if(this.§_-U1§ == param2 && param1 == "num")
         {
            return;
         }
         this.removeText();
         if(param1 == "num")
         {
            this.§_-YK§ = Utils.getMaterial("newIconTip") as MovieClip;
            this.§_-YK§.tipMc.tip.text = param2.toString() + "只可放养";
            this.§_-U1§ = param2;
         }
         else if(param1 == "back")
         {
            this.§_-YK§ = Utils.getMaterial("newIconTip") as MovieClip;
            this.§_-YK§.tipMc.tip.text = "回来啦";
         }
         this.§_-IW§.addChild(this.§_-YK§);
         var _loc3_:Point = this.localToGlobal(new Point(this.width / 2 - 60,-50));
         this.§_-YK§.x = _loc3_.x;
         this.§_-YK§.y = _loc3_.y;
         this.§_-YK§.addEventListener(Event.ENTER_FRAME,this.onTextTipCountdown,false,0,true);
      }
      
      private function getCanReleaseNum(param1:EvtAPI) : void
      {
         if(param1.data != null)
         {
            if(param1.data["value"] != null)
            {
               _canReleaseNum = int(param1.data["value"]);
            }
         }
      }

      private function bindWildClick() : void
      {
         this.§_-6s§.addEventListener(MouseEvent.CLICK,this.onWildIconClick,false,0,true);
      }

      private function onWildIconClick(param1:MouseEvent) : void
      {
         param1.stopPropagation();
         dispatchEvent(new MouseEvent(MouseEvent.CLICK,true));
      }
      
      public function set §_-5Z§(param1:String) : void
      {
         var § 0§:String = param1;
         if(this.stage != null && this.§_-IW§ == null)
         {
            this.§_-IW§ = this.stage;
         }
         this.removeText();
         removeChild(this.§_-6s§);
         if(§ 0§ == null)
         {
            this.§_-6s§ = Utils.getMaterial("Wild_Animal_Icon") as SimpleButton;
            this.§_-6s§.x = 8;
            this.bindWildClick();
            addChild(this.§_-6s§);
            return;
         }
         if(§ 0§ == "")
         {
            this.§_-6s§ = Utils.getMaterial("Wild_Animal_Icon") as SimpleButton;
            this.§_-6s§.x = 8;
            this.bindWildClick();
            addChild(this.§_-6s§);
         }
         else if(§ 0§ == "1")
         {
            this.§_-6s§ = Utils.getMaterial("Wild_Animal_Icon_Active_2") as MovieClip;
            this.§_-6s§.x = 8;
            this.bindWildClick();
            addChild(this.§_-6s§);
            _canReleaseNum = _canReleaseNum == 0 ? 1 : _canReleaseNum;
            this.§_-6s§.num_txt.gotoAndStop(_canReleaseNum);
            if(this.§_-5y§ > 0)
            {
               clearTimeout(this.§_-5y§);
               this.§_-5y§ = 0;
            }
            this.§_-5y§ = setTimeout(function():void
            {
               showText("num",_canReleaseNum);
            },500);
            this.§_-6s§.buttonMode = true;
            this.§_-6s§.addEventListener(MouseEvent.ROLL_OVER,function(param1:MouseEvent):void
            {
               §_-6s§.scaleX = 1.1;
               §_-6s§.scaleY = 1.1;
               §_-6s§.x -= 2;
               §_-6s§.y -= 2;
            });
            this.§_-6s§.addEventListener(MouseEvent.ROLL_OUT,function(param1:MouseEvent):void
            {
               §_-6s§.scaleX = 1;
               §_-6s§.scaleY = 1;
               §_-6s§.x += 2;
               §_-6s§.y += 2;
            });
         }
         else if(§ 0§ == "3")
         {
            this.§_-6s§ = Utils.getMaterial("Wild_Animal_Icon_Active_1") as MovieClip;
            this.§_-6s§.x = 8;
            this.bindWildClick();
            addChild(this.§_-6s§);
            if(this.§_-5y§ > 0)
            {
               clearTimeout(this.§_-5y§);
               this.§_-5y§ = 0;
            }
            this.§_-5y§ = setTimeout(function():void
            {
               showText("back");
            },500);
         }
      }
   }
}

